import { homeCopy as H } from '@desk/shared'
import { Qr } from '@/components/ui/qr'
import { Logo } from './Logo'

export interface ChatLatest {
  outcome: string
  summary: string
}

/**
 * The Telegram card: a still picture of the chat with the bot, drawn in the page, not a screenshot. The bot's
 * first words are its real ones (`telegramCopy.firstContact`), and the decision is the live agent's latest.
 */
export function TelegramChat({
  bot,
  link,
  latest,
}: {
  bot: string
  link: string
  latest: ChatLatest | null
}) {
  return (
    <div className="chat-card">
      <div className="chat-head">
        <Logo size={30} glow />
        <span>
          <b>Shijima</b>
          <small>
            @{bot} · {H.chat.bot}
          </small>
        </span>
      </div>
      <p className="chat-bubble">
        <b>{H.chat.hello}</b>
        {H.chat.first}
      </p>
      <p className="chat-bubble">
        <small>
          {H.chat.latest}
          {latest ? ` · ${latest.outcome}` : ''}
        </small>
        {latest?.summary ?? H.chat.none}
      </p>
      <div className="chat-foot">
        <Qr text={link} label={H.chat.scan} className="chat-qr" />
        <span>
          <b>@{bot}</b>
          {link.replace(/^https?:\/\//, '')}
        </span>
      </div>
    </div>
  )
}
