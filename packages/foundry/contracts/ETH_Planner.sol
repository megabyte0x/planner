// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";

/*//////////////////////////////////////////////////////////////
                             UNISWAP V3
//////////////////////////////////////////////////////////////*/

interface ISwapRouterV3 {
    struct ExactInputParams {
        bytes path; // tokenIn .. fee .. mid .. fee .. tokenOut
        address recipient; // receives WETH here (we unwrap to ETH after)
        uint256 deadline;
        uint256 amountIn;
        uint256 amountOutMinimum;
    }

    function exactInput(ExactInputParams calldata params) external payable returns (uint256 amountOut);
}

interface IWETH9 {
    function deposit() external payable;
    function withdraw(uint256) external;
    function approve(address, uint256) external returns (bool);
    function transfer(address, uint256) external returns (bool);
    function balanceOf(address) external view returns (uint256);
}

/**
 * @title ETHPlanner (V3 path variant)
 * @notice Target token = native ETH (via WETH unwrap).
 *         - Push flow: user transfers USDC/DAI to this contract; watcher calls executeDepositSwap(...)
 *         - Plan flow: user creates on-chain plan; keeper calls executePlan(user, ...)
 */
contract ETHPlanner is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /*//////////////////////////////////////////////////////////////
                                CONFIG
    //////////////////////////////////////////////////////////////*/

    ISwapRouterV3 public immutable router;
    IWETH9 public immutable WETH;

    // stable => allowed?
    mapping(address => bool) public allowedStable;

    // track uncredited pushed deposits so we don't double-spend
    mapping(address => uint256) public accounted; // stable => accountedBalance

    /*//////////////////////////////////////////////////////////////
                                 PLANS
    //////////////////////////////////////////////////////////////*/

    struct Plan {
        address stable; // USDC or DAI
        uint256 amount; // raw units (USDC=6, DAI=18)
        uint256 interval; // seconds
        uint256 nextExec; // unix timestamp
        bool active;
    }

    mapping(address => Plan) public plans; // user => plan

    /*//////////////////////////////////////////////////////////////
                                 EVENTS
    //////////////////////////////////////////////////////////////*/

    event StableAllowed(address indexed stable, bool allowed);
    event DepositSwapExecuted(address indexed user, address indexed stable, uint256 amountIn, uint256 amountOutETH);
    event PlanCreated(
        address indexed user, address indexed stable, uint256 amount, uint256 interval, uint256 firstExecAt
    );
    event PlanCancelled(address indexed user);
    event PlanExecuted(
        address indexed user, address indexed stable, uint256 amountIn, uint256 amountOutETH, uint256 nextExecAt
    );

    /*//////////////////////////////////////////////////////////////
                               CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/

    constructor(address _owner, address _router, address _weth) Ownable(_owner) {
        require(_router != address(0) && _weth != address(0), "bad addr");
        router = ISwapRouterV3(_router);
        WETH = IWETH9(_weth);
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
     * @notice Called by watcher/anyone after an ERC20 Transfer push to this contract.
     *         Swaps `amountIn` (from this contract's balance) into ETH and sends to `user`.
     * @param user     beneficiary that pushed funds
     * @param stable   USDC/DAI address
     * @param amountIn exact stable amount to consume from the contract (raw units)
     * @param minOut   min ETH out for slippage protection (wei, equals WETH units)
     * @param path     Uniswap V3 path bytes (must start at `stable` and end at `WETH`)
     */
    function executeDepositSwap(address user, address stable, uint256 amountIn, uint256 minOut, bytes calldata path)
        external
        nonReentrant
    {
        require(user != address(0), "bad user");
        require(allowedStable[stable], "stable not allowed");
        require(amountIn > 0, "amount=0");
        _assertPathEndsInWETH(stable, path);

        // ensure we don't spend more than newly pushed deposits
        uint256 bal = IERC20(stable).balanceOf(address(this));
        uint256 uncredited = bal - accounted[stable];
        require(amountIn <= uncredited, "exceeds uncredited");
        accounted[stable] += amountIn;

        uint256 ethOut = _swapStableForETH_Path(stable, amountIn, minOut, path);

        // send ETH directly to user
        (bool ok,) = user.call{ value: ethOut }("");
        require(ok, "eth transfer failed");

        emit DepositSwapExecuted(user, stable, amountIn, ethOut);
    }

    /*//////////////////////////////////////////////////////////////
                        RECURRING DCA PLAN (PULL)
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Create a recurring plan. User must later KEEP sufficient allowance & balance.
     * @param stable   USDC/DAI
     * @param amount   per-interval amount (raw units)
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
     * @notice Execute a user's plan. Anyone may call (keeper pattern). Pulls tokens via transferFrom.
     * @param user   plan owner
     * @param minOut min ETH out (wei) for slippage protection
     * @param path   Uniswap V3 path starting at plan.stable and ending at WETH
     */
    function executePlan(address user, uint256 minOut, bytes calldata path) external nonReentrant {
        Plan storage p = plans[user];
        require(p.active, "inactive");
        require(block.timestamp >= p.nextExec, "not due");
        _assertPathEndsInWETH(p.stable, path);

        // Pull user's stable (user must have approved this contract)
        IERC20(p.stable).safeTransferFrom(user, address(this), p.amount);

        uint256 ethOut = _swapStableForETH_Path(p.stable, p.amount, minOut, path);

        // Deliver ETH to the user
        (bool ok,) = user.call{ value: ethOut }("");
        require(ok, "eth transfer failed");

        // schedule next execution — add fixed interval from prior nextExec to avoid drift
        p.nextExec += p.interval;

        emit PlanExecuted(user, p.stable, p.amount, ethOut, p.nextExec);
    }

    /*//////////////////////////////////////////////////////////////
                               INTERNAL SWAP
    //////////////////////////////////////////////////////////////*/

    function _swapStableForETH_Path(address stable, uint256 amountIn, uint256 minOut, bytes calldata path)
        internal
        returns (uint256 ethOut)
    {
        IERC20(stable).approve(address(router), amountIn);

        // swap stable -> WETH to this contract
        uint256 wethOut = router.exactInput(
            ISwapRouterV3.ExactInputParams({
                path: path, // must end in WETH
                recipient: address(this),
                deadline: block.timestamp,
                amountIn: amountIn,
                amountOutMinimum: minOut
            })
        );

        // unwrap WETH -> ETH (1:1)
        WETH.withdraw(wethOut);
        ethOut = wethOut;
    }

    /*//////////////////////////////////////////////////////////////
                                PATH CHECKS
    //////////////////////////////////////////////////////////////*/

    /// @dev Ensures path starts with `stable` and ends with WETH; also validates length form.
    function _assertPathEndsInWETH(address stable, bytes calldata path) internal view {
        uint256 len = path.length;
        require(len >= 43, "path too short"); // 20(token) + 3(fee) + 20(token)
        require((len - 20) % 23 == 0, "bad path len"); // 20 + n*(3+20)

        address tokenIn = _pathFirstToken(path);
        address tokenOut = _pathLastToken(path);

        require(tokenIn == stable, "path start != stable");
        require(tokenOut == address(WETH), "path end != WETH");
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
                                  RESCUE
    //////////////////////////////////////////////////////////////*/

    function rescueERC20(address token, address to, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(to, amount);
    }

    function rescueETH(address payable to, uint256 amount) external onlyOwner {
        (bool ok,) = to.call{ value: amount }("");
        require(ok, "eth transfer failed");
    }

    /*//////////////////////////////////////////////////////////////
                                   MISC
    //////////////////////////////////////////////////////////////*/

    // receive ETH from WETH.withdraw()
    receive() external payable { }
}
