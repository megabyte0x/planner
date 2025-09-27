0) TL;DR
	•	Two target-specific contracts:
	•	ETHPlanner: swaps USDC/DAI → ETH (via WETH unwrap).
	•	ERC20_Planner (configured with cbBTC): swaps USDC/DAI → cbBTC (ERC-20).
	•	Two ways to swap:
	1.	Push deposit: user transfers USDC/DAI directly to the planner contract; a watcher detects the ERC-20 Transfer and calls the contract to execute the swap and send output to the user.
	2.	Recurring plan (on-chain DCA): user creates a plan (amount, interval, stable); a keeper/watcher calls the contract per schedule; the contract pulls funds via transferFrom (after user approval), swaps, and transfers output to the user.
	•	Swapping via Uniswap V3, supporting:
	•	Multi-hop (bytes path) using exactInput.
	•	Single-hop using exactInputSingle (exact-input) and exactOutputSingle (exact-output + refunds).
	•	Networks: start Sepolia, then Base mainnet, finally Ethereum mainnet.
	•	Off-chain: Node/TS watcher (event listener + scheduler). Frontend: Next.js dApp with wallet connect.

⸻

1) Goals & Scope
	•	Goal: Let any user convert USDC/DAI into ETH or cbBTC either immediately after sending tokens, or periodically on a fixed schedule, with minimal friction.
	•	Scope:
	•	Solidity contracts (Foundry) with Uniswap V3 integration.
	•	Node TypeScript service for deposit detection and plan execution scheduling.
	•	Next.js frontend for approvals, plan creation, monitoring.

⸻

2) Smart Contracts

2.1 Common design
	•	Allowed stables: allowedStable[address] gate (USDC/DAI).
	•	Push-deposit accounting: accounted[stable] tracks how many pushed tokens have already been swapped, preventing double-spend. When the watcher calls a deposit swap, it caps amountIn <= (balanceOf(this) - accounted[stable]).
	•	Plans:

struct Plan {
  address stable;    // USDC or DAI
  uint256 amount;    // raw units
  uint256 interval;  // seconds
  uint256 nextExec;  // unix timestamp
  bool    active;
}
mapping(address => Plan) public plans; // user => plan

	•	createPlan(stable, amount, interval) sets nextExec = now + interval.
	•	cancelPlan() deactivates.
	•	On execution, contracts do nextExec += interval (no drift).

	•	Events:
	•	StableAllowed(stable, allowed)
	•	One-time: DepositSwapExecuted(user, stable, amountIn, amountOut)
	•	Plans: PlanCreated(user, stable, amount, interval, firstExecAt), PlanCancelled(user), PlanExecuted(user, stable, amountIn, amountOut, nextExecAt)
	•	Safety:
	•	SafeERC20 everywhere; two-step approvals (safeApprove(0) then safeApprove(amount)).
	•	ReentrancyGuard on mutating entrypoints.
	•	Slippage via amountOutMinimum (caller must choose).
	•	Exact-output flows refund unused input and account only what was spent.

Uniswap V3 calls supported
	•	Path (multi-hop): router.exactInput(ExactInputParams{ path, recipient, deadline, amountIn, amountOutMinimum })
	•	Single-hop:
	•	Exact-input: router.exactInputSingle(ExactInputSingleParams{ tokenIn, tokenOut, fee, recipient, deadline, amountIn, amountOutMinimum, sqrtPriceLimitX96:0 })
	•	Exact-output: router.exactOutputSingle(ExactOutputSingleParams{ tokenIn, tokenOut, fee, recipient, deadline, amountOut, amountInMaximum, sqrtPriceLimitX96:0 })

Fees/paths are provided by the off-chain caller (watcher/keeper/UI). Contracts only validate that a path starts at the declared stable and ends at the expected target.

⸻

2.2 ETHPlanner (USDC/DAI → ETH)
	•	Holds immutable router (Uniswap V3) and WETH9 addresses.
	•	Push deposit flows:
	•	Multi-hop: executeDepositSwap(user, stable, amountIn, minOut, path)
	•	Validates path ends in WETH, swaps stable → WETH, unwraps to ETH, sends to user, emits DepositSwapExecuted.
	•	Single-hop exact-input: executeDepositSwapSingleIn(user, stable, amountIn, minOut, fee)
	•	Single-hop exact-output: executeDepositSwapSingleOut(user, stable, amountOutETH, amountInMax, fee) with refund of unspent stable, and accounted increments by spent only.
	•	Plan flows:
	•	createPlan(stable, amount, interval)
	•	executePlan(user, minOut, path) (multi-hop; ends in WETH → unwrap → ETH to user)
	•	executePlanSingleIn(user, minOut, fee) (single exact-input)
	•	executePlanSingleOut(user, amountOutETH, amountInMax, fee) (single exact-output + refund)
	•	Unwrap: WETH.withdraw(wethOut); receive() enabled to accept ETH.

2.3 ERC20_Planner (USDC/DAI → assigned ERC-20, configure with cbBTC)
	•	Immutable router and assigned_token (set to cbBTC per deployment).
	•	Push deposit flows:
	•	Multi-hop: executeDepositSwap(user, stable, amountIn, minOut, path) (path must end in assigned_token)
	•	Single-hop exact-input: executeDepositSwapSingleIn(user, stable, amountIn, minOut, fee)
	•	Single-hop exact-output: executeDepositSwapSingleOut(user, stable, amountOutToken, amountInMax, fee) + refund
	•	Plan flows:
	•	createPlan(stable, amount, interval)
	•	executePlan(user, minOut, path) (multi-hop)
	•	executePlanSingleIn(user, minOut, fee)
	•	executePlanSingleOut(user, amountOutToken, amountInMax, fee) + refund
	•	Output token (cbBTC) sent directly via safeTransfer(user, out).

2.4 Admin & rescue
	•	setStable(stable, allowed) by owner to gate input tokens.
	•	rescueERC20(token, to, amount); on ETHPlanner also rescueETH(to, amount).

⸻

3) Off-Chain Watcher/Keeper (Node + TypeScript)

3.1 Responsibilities
	1.	Deposit watcher:
	•	Subscribe to USDC and DAI Transfer events with to == planner address.
	•	On detection, derive {user, token, amount} from the log.
	•	Build the preferred route:
	•	Use single-hop if a direct pool exists (e.g., USDC/WETH fee 500; DAI/WETH fee 3000; USDC/cbBTC if applicable).
	•	Else construct a multi-hop path (e.g., USDC → WETH → cbBTC).
	•	Choose slippage → set amountOutMinimum.
	•	Call the corresponding deposit function on ETHPlanner/ERC20_Planner:
	•	Single-hop exact-input: executeDepositSwapSingleIn(...)
	•	Or path: executeDepositSwap(...)
	•	For exact-output use executeDepositSwapSingleOut(...) (and set amountInMax).
	•	Log success (DepositSwapExecuted) or error.
	2.	Plan scheduler:
	•	Track PlanCreated, PlanCancelled.
	•	Maintain an in-memory or DB schedule with nextExec per user.
	•	Periodically (e.g., every N seconds) run a due-check: for each active plan, if now >= nextExec, execute:
	•	Pull funds on-chain via planner’s executePlan* function.
	•	Prefer single-hop routes when available; fallback to path.
	•	On success, contracts auto-bump nextExec and emit PlanExecuted. Update local state.

3.2 Reliability & safety
	•	Confirmations: Optionally wait 1–3 confirmations for deposit events before triggering swaps.
	•	Reorgs: If reorg detected, re-evaluate pending work (idempotent by contract design).
	•	Allowance/funds: On plan execution failure (insufficient allowance/funds), log; retry next interval.
	•	Config: Router/WETH/USDC/DAI/cbBTC addresses per network, fee tiers, slippage bps, RPC URLs, service key for gas.

3.3 Helpers
	•	V3 path encoder (TS) for multi-hop: concat [token, fee(3 bytes), token, fee, token].
	•	Fee table per chain (configurable), e.g., { USDC/WETH: 500, DAI/WETH: 3000 }.

⸻

4) Frontend (Next.js)

4.1 Pages & flows
	•	Connect wallet (wagmi/RainbowKit or ethers + MetaMask).
	•	Instant swap:
	•	Pick target (ETH or BTC/cbBTC) → select corresponding planner.
	•	Pick stable (USDC/DAI), amount.
	•	Approve planner to spend (for plan/pull flow) OR show contract address for direct token transfer (push flow).
	•	If using function path (recommended UX): call deposit + swap by directly transferring token to contract (push) or call a helper function you expose; watcher completes swap → show “Swap in progress” until DepositSwapExecuted.
	•	Create plan:
	•	Form: stable, amount, interval (per minute/day, etc.).
	•	Approve planner (at least amount; user can approve larger to reduce re-approvals).
	•	Call createPlan(...).
	•	Show active plan card (next execution ETA, last execution).
	•	Cancel plan → cancelPlan().

4.2 Status & history
	•	Read plans[user] from contract for live data.
	•	Listen for PlanExecuted/DepositSwapExecuted for real-time updates.
	•	Optionally query the Node’s small status API (e.g., recent swaps feed).

4.3 Network UX
	•	Support Sepolia, Base, Mainnet with chain detection/prompts and per-network addresses.
	•	Show slippage info and estimated outputs (optional: fetch quote via SDK or a price API).

⸻

5) Deployment & Configuration

5.1 Addresses (to be filled in configs)
	•	Per chain:
	•	Uniswap V3 SwapRouter address
	•	WETH9 address (for ETHPlanner)
	•	USDC, DAI addresses
	•	cbBTC address (for ERC20_Planner)
	•	Planner contracts:
	•	Deploy ETHPlanner(owner, router, WETH); then setStable(USDC, true), setStable(DAI, true).
	•	Deploy ERC20_Planner(owner, router, cbBTC); then setStable(USDC, true), setStable(DAI, true).

5.2 Environment (Node)

RPC_WS=...
RPC_HTTP=...
PRIVATE_KEY=...        # executor key
CHAIN_ID=...
ROUTER=0x...
WETH=0x...
USDC=0x...
DAI=0x...
CBBTC=0x...
ETH_PLANNER=0x...
CBBTC_PLANNER=0x...
SLIPPAGE_BPS=50        # example: 0.50%
CONFIRMATIONS=1


⸻

6) Testing (Foundry)

6.1 Unit tests
	•	Push deposit:
	•	Mint mock USDC/DAI to test user.
	•	transfer to planner; simulate watcher calling executeDepositSwapSingleIn (and executeDepositSwap).
	•	Assert accounted increments, output sent to user, events emitted.
	•	Exact-output flows:
	•	Provide amountInMax; assert refund to user, accounted increment equals spent.
	•	Plans:
	•	createPlan and time-travel to nextExec; call executePlanSingleIn (and path variant).
	•	Assert nextExec bumped by interval; output delivered; events emitted.
	•	Reentrancy & approvals: fuzz inputs; confirm SafeERC20 paths and ReentrancyGuard hold.

6.2 Integration
	•	Fork Sepolia/Base/Mainnet and execute real swaps with tiny amounts to verify routing & fees.

⸻

7) Security & Design Notes
	•	No ERC-20 receive hook: push transfers require off-chain trigger; handled by watcher.
	•	Idempotency:
	•	Push deposits: uncredited = balance - accounted → can’t over-spend.
	•	Exact-output: refund & account only spent.
	•	Reentrancy: CEI pattern; nonReentrant; external transfers (ETH/token) after state updates.
	•	Slippage: amountOutMinimum must be set by caller; for demo, use conservative bps; production should fetch quotes.
	•	Approvals: safeApprove(0) then safeApprove(N); trim back to 0 after exact-output route (optional hardening).
	•	Decimals: USDC(6), DAI(18), ETH/WETH(18), cbBTC(decimals per deployment); UI must format properly.
	•	Access: Execution functions are public/permissionless so anyone can help execute. (Optionally restrict to a role if you want centralized control.)

⸻

8) Developer API (Key Function Signatures)

ETHPlanner

// Push deposit (multi-hop path → ends in WETH → unwrap to ETH)
function executeDepositSwap(address user, address stable, uint256 amountIn, uint256 minOut, bytes calldata path) external;

// Push deposit (single-hop exact-input)
function executeDepositSwapSingleIn(address user, address stable, uint256 amountIn, uint256 minOut, uint24 fee) external;

// Push deposit (single-hop exact-output + refund)
function executeDepositSwapSingleOut(address user, address stable, uint256 amountOutETH, uint256 amountInMax, uint24 fee) external;

// Plans
function createPlan(address stable, uint256 amount, uint256 interval) external;
function cancelPlan() external;

function executePlan(address user, uint256 minOut, bytes calldata path) external;
function executePlanSingleIn(address user, uint256 minOut, uint24 fee) external;
function executePlanSingleOut(address user, uint256 amountOutETH, uint256 amountInMax, uint24 fee) external;

ERC20_Planner (assigned_token = cbBTC)

function executeDepositSwap(address user, address stable, uint256 amountIn, uint256 minOut, bytes calldata path) external;
function executeDepositSwapSingleIn(address user, address stable, uint256 amountIn, uint256 minOut, uint24 fee) external;
function executeDepositSwapSingleOut(address user, address stable, uint256 amountOutToken, uint256 amountInMax, uint24 fee) external;

function createPlan(address stable, uint256 amount, uint256 interval) external;
function cancelPlan() external;

function executePlan(address user, uint256 minOut, bytes calldata path) external;
function executePlanSingleIn(address user, uint256 minOut, uint24 fee) external;
function executePlanSingleOut(address user, uint256 amountOutToken, uint256 amountInMax, uint24 fee) external;


⸻

9) Watcher/Keeper Pseudocode (TS)

// deposit listener
on ERC20(USDC, DAI).Transfer(from, to, value) if to == PLANNER:
  route = pickRoute(stable=token, target=ETH|cbBTC) // fee or path
  if singleHop:
     call planner.executeDepositSwapSingleIn(from, token, value, minOut, fee)
  else:
     path = encodePath([token, fee1, mid, fee2, target])
     call planner.executeDepositSwap(from, token, value, minOut, path)

// plan scheduler
loop every T seconds:
  for each active plan (from events or on-chain):
    if now >= plan.nextExec:
       if singleHop:
          call planner.executePlanSingleIn(user, minOut, fee)
       else:
          call planner.executePlan(user, minOut, path)


⸻

10) Frontend UX Notes
	•	Instant swap: show planner address; offer “Send USDC/DAI to this address” (push) or (optionally) a one-click function call if you expose it.
	•	Create plan: approve + createPlan; show countdown to nextExec.
	•	Feedback: listen for DepositSwapExecuted / PlanExecuted; show recent executions.
	•	Network switching: prompt to Sepolia/Base/Mainnet with correct addresses.

⸻

11) Deliverables
	•	packages/foundry/contracts/ETH_Planner.sol
	•	packages/foundry/contracts/ERC20_Planner.sol (assigned_token = cbBTC)
	•	Foundry tests (unit + fork)
	•	Node/TS watcher with:
	•	Deposit listener
	•	Plan scheduler
	•	Config for Sepolia/Base/Mainnet
	•	Next.js dApp:
	•	Wallet connect, approve, create/cancel plan
	•	Instant swap UX (push flow) and plan dashboard
	•	Network/address config

⸻

12) Configuration Knobs (no assumptions baked in)
	•	Per-network addresses (Router, WETH, USDC, DAI, cbBTC).
	•	Fee tiers per pair (e.g., USDC/WETH 500, DAI/WETH 3000) — configurable.
	•	Slippage bps; confirmations to wait; scheduler tick interval.
	•	Whether to prefer single-hop or path per asset.

⸻

This captures the current design decisions you specified:
	•	Uniswap integration,
	•	cbBTC as BTC representation,
	•	Sepolia → Base → Mainnet rollout,
	•	On-chain plan storage,
	•	Pull via transferFrom (with user approvals),
	•	msg.sender as the user identity.

If you want this converted into a concise “handoff brief” for an engineer (or a milestone task list), say the word and I’ll trim it to a punchy checklist.