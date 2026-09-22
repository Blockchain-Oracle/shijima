-- Moves a running desk's settings from one contract to its successor, in one transaction.
--   psql "$DATABASE_URL" -v old=<old desk address> -v new=<new desk address> -v version=v1 \
--        -v factory=<new factory> -v deploy_tx=<create tx> -v close_tx=<old desk's revokeOperator tx> \
--        -f scripts/move-desk.sql
--
-- Run it after the funds have moved on chain and before the worker starts again. The old desk's records stay
-- where they are, readable; the new desk starts its own record at 0. What carries over is what the owner chose:
-- the mandate, the mode and what it has earned, the public link, the linked Telegram and the price alerts.
\set ON_ERROR_STOP on
begin;

create temp table moved on commit drop as
select id as old_id, null::uuid as new_id, share_slug from desks
where address = lower(:'old') and lifecycle = 'running';
-- Exactly one running desk, or nothing happens.
select 1 / (count(*) = 1)::int from moved;

-- The public link is unique, so it leaves the old desk before the new one takes it.
update desks set share_slug = null where id = (select old_id from moved);

insert into desks (owner_id, chain_id, address, factory, salt, contract_version, operator, name, mode, state,
                   lifecycle, deployed_at, deploy_tx, first_funded_at, telegram_skipped_at, started_at,
                   share_slug, share_enabled, drawdown_baseline_usdg, shadow_checks, shadow_report_opened_at,
                   live_armed_at)
select owner_id, chain_id, lower(:'new'), lower(:'factory'), salt, :'version', operator, name, mode, state,
       'running', now(), lower(:'deploy_tx'), now(), telegram_skipped_at, now(),
       (select share_slug from moved), share_enabled, drawdown_baseline_usdg, shadow_checks,
       shadow_report_opened_at, live_armed_at
from desks where id = (select old_id from moved);
update moved set new_id = (select id from desks where address = lower(:'new'));

insert into mandates (desk_id, version, status, applied_at, targets, drift_tolerance_bps, max_position_bps,
                      per_action_cap_usdg, daily_cap_usdg, loss_stop_bps, large_action_usdg, compiled_rules,
                      read_back, preset, notes)
select (select new_id from moved), 1, 'applied', now(), targets, drift_tolerance_bps, max_position_bps,
       per_action_cap_usdg, daily_cap_usdg, loss_stop_bps, large_action_usdg, compiled_rules, read_back, preset, notes
from mandates where desk_id = (select old_id from moved) and status = 'applied';

-- Moved, not revoked: the owner keeps talking to the same chat.
update telegram_links set desk_id = (select new_id from moved)
where desk_id = (select old_id from moved) and status = 'linked';
update price_alerts set desk_id = (select new_id from moved) where desk_id = (select old_id from moved);

-- The old desk closes as closeDesk does: promises cancelled, checks stop, the record stays readable.
update approvals set status = 'cancelled', cancelled_reason = 'the desk moved to a new contract'
where desk_id = (select old_id from moved) and status = 'pending';
update deferrals set status = 'cancelled', ended_reason = 'the desk moved to a new contract', ended_at = now()
where desk_id = (select old_id from moved) and status = 'standing';
update telegram_links set status = 'revoked', revoked_at = now()
where desk_id = (select old_id from moved) and status = 'pending';
update desks set lifecycle = 'closed', closed_at = now(), state = 'paused_by_owner', state_reason = null,
                 updated_at = now()
where id = (select old_id from moved);
insert into desk_events (desk_id, kind, actor, via, detail, at)
select old_id, 'closed', 'owner', 'chain', jsonb_build_object('txHash', lower(:'close_tx'), 'movedTo', lower(:'new')), now()
from moved;

select d.address, d.contract_version, d.lifecycle, d.mode, d.share_slug,
       (select count(*) from mandates m where m.desk_id = d.id and m.status = 'applied') as mandates,
       (select count(*) from telegram_links t where t.desk_id = d.id and t.status = 'linked') as telegram
from desks d order by d.created_at;
commit;
