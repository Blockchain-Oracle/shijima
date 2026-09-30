# Email sign-in and the always-available assistant

## User journeys

- Sign in opens a choice between email and the existing wallet picker. Email sends a six-digit code, supports paste and mobile autofill, then opens the wallet associated with that verified email. New email users receive an embedded Ethereum wallet. A single wallet completes app sign-in automatically; multiple wallets require an explicit owner choice.
- An existing wallet owner can link email in account settings. The owning wallet first signs a Privy authentication message; the email then completes OTP verification. The server checks both verified accounts before preserving the same owner address and agents. Linking an email already belonging to another account surfaces the provider's error rather than merging ownership.
- Email login can restore access to an external wallet's account without an extension. Transactions still require that wallet. An embedded email wallet reconnects through the existing wagmi transaction path.
- Ask Shijima is available on the website and app before creating an agent. Signed-in users can ask general questions with conversation history; selecting an agent supplies that agent's context. Visitors can discover tokens and onboarding routes, with an explicit sign-in prompt for AI answers.
- Token mentions and searches render approved-token cards with the existing local logos and available logged prices. The assistant keeps charts, proposal review and confirmation flows. On phones it opens as a bottom drawer with a grab handle, drag-to-dismiss, compact and expanded heights, and a composer that follows the onscreen keyboard. The Agents navigation stays unchanged.

## Provider choice and implementation

Privy supplies headless email OTP, wallet authentication, verified account linking and embedded wallets. The custom form retains Shijima's typography, accent and touch targets. One native OTP input supports screen readers, paste and `one-time-code` autofill without six independent fields. Resending has a visible cooldown; in-flight submissions are locked.

The backend verifies the access token, fetches the user's current linked accounts and requires verified email plus the requested verified Ethereum wallet. It does not trust a client-submitted address or an older identity token after a wallet is unlinked. The existing iron-session cookie and address-based ownership remain the application session.

Headless `loginWithCode` does not run Privy's modal-only `createOnLogin` behavior. After OTP, the client refreshes the user and explicitly creates an Ethereum wallet only when none is linked. Creation is single-flight across retries. Setup and session completion have a 40-second UI deadline and recovery; existing verified email sessions can continue without requesting another OTP. Success appears only after the backend saves the app session. A session-change event refreshes mounted gift cards, while the router refresh updates the header and onboarding.

The existing EIP-6963 and WalletConnect picker remains intact. Embedded wallets connect through the public EIP-1193 wagmi connector API. The Privy wagmi adapter was not used because it replaces connectors managed by the existing picker.

No new database migration is required. Owner-scoped conversation queries now support a null agent ID, and the worker includes that general conversation's history.

## Configuration

`apps/web/.env.local` is ignored by Git. Configure `NEXT_PUBLIC_PRIVY_APP_ID` and `PRIVY_APP_SECRET` there. The secret is server-only. Both variables must also exist when building and running a deployment for email login to appear enabled.

In the Privy dashboard, enable email and Ethereum wallet authentication and retain embedded wallet support. Local previews use `http://localhost:3007` and `http://localhost:3027`.

The user supplied production Shijima app credentials after activating production. They are saved locally in the ignored environment file with owner-only permissions and authenticated against Privy's server API successfully (HTTP 200). Public configuration confirms email and Ethereum wallet authentication are enabled, with `https://shijima.xyz` as the allowed production domain. Coolify's `shijima-web` resource deploys `main` using `apps/web/Dockerfile`. The public app ID is configured for build and runtime; the server secret is runtime-only. The Dockerfile passes only the public ID into the browser build. Deployment completion is verified separately through Coolify and the live app.

## Evidence and remaining acceptance

- Web TypeScript check passed.
- Full workspace TypeScript checks and Vitest passed: 19 files, 124 tests. The web/core subset includes 40 tests covering forged tokens and wallet addresses, unverified accounts, removed links, owner mismatch, same-origin requests, database and cookie-save failure, headless wallet creation, preserving existing wallets, setup timeout recovery, general conversation history and whole-token matching.
- 21st UI review reported no errors or warnings. Its single suggestion concerned the established brand accent in provider configuration.
- The stalled preview cache was moved aside and the development server restarted successfully on port 3027. `/home` and the assistant token catalog return HTTP 200.
- Real email session completion returned HTTP 200 from `/api/auth/email`. Zen subsequently showed the signed-in owner in the header and wallet page, and the gift claim action instead of a sign-in gate. The user continued through wallet, funding and agent creation screens.
- Browser checks at 390×844 and 320×700 confirmed the mobile assistant drawer stays within the viewport without horizontal overflow. Expanded mode leaves a 16px top margin; compact mode uses 72% of screen height. Escape closes the drawer. The email form also fit within the viewport (352×490 at x16/y177). Physical-phone touch dragging and keyboard behavior, a hard-reload email session walkthrough and existing-wallet linking remain separate acceptance checks.
- Changed files pass Biome checks. Full-repository lint has pre-existing errors in the demo video's missing caption track and two unrelated untracked brand SVGs; those files are outside this change.

## Primary references

- [Privy email authentication](https://docs.privy.io/authentication/user-authentication/login-methods/email)
- [Privy account linking](https://docs.privy.io/user-management/users/linking-accounts)
- [Headless wallet authentication](https://docs.privy.io/authentication/user-authentication/login-methods/wallet)
- [Access-token verification](https://docs.privy.io/authentication/user-authentication/access-tokens)
- [Content Security Policy requirements](https://docs.privy.io/security/implementation-guide/content-security-policy)
- [Privy wagmi integration](https://docs.privy.io/wallets/connectors/ethereum/integrations/wagmi)
- [Automatic wallet creation applies only to the Privy modal](https://docs.privy.io/basics/react/advanced/automatic-wallet-creation)
- [Explicit embedded-wallet creation](https://docs.privy.io/wallets/wallets/create/create-a-wallet)
