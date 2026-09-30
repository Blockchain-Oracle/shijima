# Shijima design context

Next.js 16, React 19, Tailwind 4, wagmi 3, and Base UI. Use the existing light and dark tokens from `apps/web/styles/kit/tokens.css` and the established Robin Neon accent #CCFF00. Preserve the crescent mark.

Reuse Modal, TokenLogo, ShijimaMark and DeskChat. The assistant must be available before agent creation, with avatars, verified token cards and clear visitor discovery versus AI states. Email sign-in uses one accessible six-digit input, native OTP autofill and paste, a resend cooldown, recoverable errors, and an explicit wallet choice. On mobile, protect the composer from the keyboard and safe-area overlap.

References searched on 21st.dev: OTP Verification Field (coss.com), OTP Verification Card (sean0205), AI Chat Card (arihantcodes_1f7b8c4d), and Suggestions (serafimcloud). Search results informed interaction design; no catalog component code was copied.

On phones, Ask Shijima is a bottom drawer with a grab handle, compact and expanded heights, a dimmed backdrop, and a keyboard-aware composer. Preserve the existing Agents navigation.
