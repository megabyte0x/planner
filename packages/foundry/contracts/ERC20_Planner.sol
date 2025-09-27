// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";

/*//////////////////////////////////////////////////////////////
                        UNISWAP V3
//////////////////////////////////////////////////////////////*/

interface ISwapRouterV3 {
    struct ExactInputParams {
        bytes path;
        address recipient;
        uint256 deadline;
        uint256 amountIn;
        uint256 amountOutMinimum;
    }

    function exactInput(ExactInputParams calldata params) external payable returns (uint256 amountOut);
}

/**
 * @title ERC20 Planner
 * @notice Target token = ERC-20 . Swaps USDC/DAI -> erc20 via Uniswap V3.
 *         - Push flow: user transfers USDC/DAI to this contract; watcher calls executeDepositSwap(...)
 *         - Plan flow: user creates an on-chain plan; keeper calls executePlan(user, ...)
 */
contract ERC20_Planner is Ownable, ReentrancyGuard {
    ISwapRouterV3 public immutable router;
    address public immutable assigned_token; // target token (ERC-20)

    /*//////////////////////////////////////////////////////////////
                                 CONFIG
    //////////////////////////////////////////////////////////////*/

    // stable => allowed?
    mapping(address => bool) public allowedStable;

    // Track uncredited pushed deposits (stable => accountedBalance)
    mapping(address => uint256) public accounted;

    /*//////////////////////////////////////////////////////////////
                                  PLANS
    //////////////////////////////////////////////////////////////*/

    struct Plan {
        address stable; // USDC or DAI
        uint256 amount; // per-interval (raw units)
        uint256 interval; // seconds
        uint256 nextExec; // unix timestamp
        bool active;
    }

    mapping(address => Plan) public plans; // user => plan

    /*//////////////////////////////////////////////////////////////
                                  EVENTS
    //////////////////////////////////////////////////////////////*/

    event StableAllowed(address indexed stable, bool allowed);

    event DepositSwapExecuted(address indexed user, address indexed stable, uint256 amountIn, uint256 amountOut);

    event PlanCreated(
        address indexed user, address indexed stable, uint256 amount, uint256 interval, uint256 firstExecAt
    );

    event PlanCancelled(address indexed user);

    event PlanExecuted(
        address indexed user, address indexed stable, uint256 amountIn, uint256 amountOut, uint256 nextExecAt
    );

    /*//////////////////////////////////////////////////////////////
                                CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/

    constructor(address _owner, address _router, address _token) Ownable(_owner) {
        require(_router != address(0) && _token != address(0), "bad addr");
        router = ISwapRouterV3(_router);
        assigned_token = _token;
    }

    /*//////////////////////////////////////////////////////////////
                               ADMIN / SETUP
    //////////////////////////////////////////////////////////////*/

    function setStable(address stable, bool allowed) external onlyOwner {
        allowedStable[stable] = allowed;
        emit StableAllowed(stable, allowed);
    }

    /*//////////////////////////////////////////////////////////////
                         ONE-TIME DEPOSIT SWAP (PUSH)
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Called by watcher/anyone after an ERC20 Transfer to this contract.
     *         Swaps `amountIn` (from this contract's balance) into ERC 20 and sends to `user`.
     * @param user       beneficiary that pushed funds
     * @param stable     USDC/DAI address
     * @param amountIn   amount of stable to consume (raw units)
     * @param minOut     min ERC 20 out (raw units) for slippage protection
     * @param path       Uniswap V3 path bytes (e.g., abi.encodePacked(stable, fee1, mid, fee2, assigned_token))
     */
    function executeDepositSwap(address user, address stable, uint256 amountIn, uint256 minOut, bytes calldata path)
        external
        nonReentrant
    {
        require(user != address(0), "bad user");
        require(allowedStable[stable], "stable not allowed");
        require(amountIn > 0, "amount=0");
        _assertPath(stable, path);

        uint256 bal = IERC20(stable).balanceOf(address(this));
        uint256 uncredited = bal - accounted[stable];
        require(amountIn <= uncredited, "exceeds uncredited");
        accounted[stable] += amountIn;

        uint256 out = _swapViaPath(stable, amountIn, minOut, path);

        // Deliver ERC 20 to user
        IERC20(assigned_token).transfer(user, out);

        emit DepositSwapExecuted(user, stable, amountIn, out);
    }

    /*//////////////////////////////////////////////////////////////
                            RECURRING DCA PLAN (PULL)
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Create a recurring plan (on-chain). User must keep allowance & balance.
     * @param stable   USDC/DAI
     * @param amount   per-interval (raw units)
     * @param interval seconds between executions
     */
    function createPlan(address stable, uint256 amount, uint256 interval) external {
        require(allowedStable[stable], "stable not allowed");
        require(amount > 0, "amount=0");
        require(interval > 0, "interval=0");
        Plan storage p = plans[msg.sender];
        require(!p.active, "plan exists");

        p.stable = stable;
        p.amount = amount;
        p.interval = interval;
        p.nextExec = block.timestamp + interval;
        p.active = true;

        emit PlanCreated(msg.sender, stable, amount, interval, p.nextExec);
    }

    function cancelPlan() external {
        Plan storage p = plans[msg.sender];
        require(p.active, "no plan");
        p.active = false;
        emit PlanCancelled(msg.sender);
    }

    /**
     * @notice Execute a user's plan. Anyone may call (keeper pattern).
     * @param user   plan owner
     * @param minOut min ERC 20 out (raw units) for slippage protection
     * @param path   Uniswap V3 path starting at plan.stable and ending at assigned_token
     */
    function executePlan(address user, uint256 minOut, bytes calldata path) external nonReentrant {
        Plan storage p = plans[user];
        require(p.active, "inactive");
        require(block.timestamp >= p.nextExec, "not due");
        _assertPath(p.stable, path);

        // Pull user's stable (requires allowance)
        IERC20(p.stable).transferFrom(user, address(this), p.amount);

        // Swap to ERC 20 (recipient = this)
        uint256 out = _swapViaPath(p.stable, p.amount, minOut, path);

        // Send ERC 20 to user
        IERC20(assigned_token).transfer(user, out);

        // Schedule next exec — add fixed interval from prior nextExec to avoid drift
        p.nextExec += p.interval;

        emit PlanExecuted(user, p.stable, p.amount, out, p.nextExec);
    }

    /*//////////////////////////////////////////////////////////////
                               INTERNAL SWAP
    //////////////////////////////////////////////////////////////*/

    function _swapViaPath(address stable, uint256 amountIn, uint256 minOut, bytes calldata path)
        internal
        returns (uint256 amountOut)
    {
        // Approve router for the exact amount (reset to zero first for non-standard ERC20s)
        IERC20(stable).approve(address(router), 0);
        IERC20(stable).approve(address(router), amountIn);

        amountOut = router.exactInput(
            ISwapRouterV3.ExactInputParams({
                path: path, // must end in assigned_token
                recipient: address(this), // receive ERC 20 here to then forward to user
                deadline: block.timestamp,
                amountIn: amountIn,
                amountOutMinimum: minOut
            })
        );
    }

    /*//////////////////////////////////////////////////////////////
                                PATH CHECKS
    //////////////////////////////////////////////////////////////*/

    /// @dev Ensures path starts with `stable` and ends with assigned_token; also validates length form.
    function _assertPath(address stable, bytes calldata path) internal view {
        uint256 len = path.length;
        require(len >= 43, "path too short"); // 20(token) + 3(fee) + 20(token)
        require((len - 20) % 23 == 0, "bad path len"); // 20 + n*(3+20)

        address tokenIn = _pathFirstToken(path);
        address tokenOut = _pathLastToken(path);

        require(tokenIn == stable, "path start != stable");
        require(tokenOut == assigned_token, "path end != ERC 20");
    }

    function _pathFirstToken(bytes calldata path) internal pure returns (address token) {
        // path layout: [token0(20) | fee(3) | token1(20) | fee(3) | token2(20) | ...]
        assembly {
            token := shr(96, calldataload(path.offset)) // first 20 bytes
        }
    }

    function _pathLastToken(bytes calldata path) internal pure returns (address token) {
        // last token starts at: path.offset + path.length - 20
        uint256 start;
        assembly {
            start := add(add(path.offset, path.length), sub(0, 20))
            token := shr(96, calldataload(start))
        }
    }

    /*//////////////////////////////////////////////////////////////
                                  RESCUES
    //////////////////////////////////////////////////////////////*/

    function rescueERC20(address token, address to, uint256 amount) external onlyOwner {
        IERC20(token).transfer(to, amount);
    }
}
