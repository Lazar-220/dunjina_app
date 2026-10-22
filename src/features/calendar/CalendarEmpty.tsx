import { formatMonthTitle, monthGrid, yearMonthOf, type IsoDate } from '../../domain/dates';
import { Icon } from '../../shared/ui/Icon';

const WEEK_PREVIEW: { initial: string; dot: string | null }[] = [
  { initial: 'M', dot: 'dot sq t-lo' },
  { initial: 'T', dot: 'dot t-iv' },
  { initial: 'W', dot: 'dot t-ez' },
  { initial: 'T', dot: 'dot sq t-up' },
  { initial: 'F', dot: 'dot t-tp' },
  { initial: 'S', dot: null },
  { initial: 'S', dot: 'dot t-lr' },
];

/** No plans and nothing logged yet: explain the app and offer the two ways in. */
export function CalendarEmpty({ today }: { today: IsoDate }) {
  const month = yearMonthOf(today);
  return (
    <>
      <div className="top">
        <div className="grow col g4">
          <span className="sm muted">No active plan</span>
          <h1 className="title">{formatMonthTitle(month)}</h1>
        </div>
      </div>
      <div style={{ padding: '0 10px', flex: 'none', opacity: 0.55 }} aria-hidden="true">
        <div className="mgrid">
          {monthGrid(month).map((date) => (
            <div
              key={date}
              className={['day', yearMonthOf(date).month !== month.month && 'out', date === today && 'today']
                .filter(Boolean)
                .join(' ')}
            >
              <span className="n">{Number(date.slice(8))}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="scroll" style={{ justifyContent: 'center', paddingBottom: 96 }}>
        <div className="card col g16" style={{ alignItems: 'center', padding: '22px 18px', textAlign: 'center' }}>
          <div className="empty-week" aria-hidden="true">
            {WEEK_PREVIEW.map(({ initial, dot }, i) => (
              <span key={i}>
                {initial}
                <i className={dot ?? 'dot'} style={dot ? undefined : { background: 'transparent' }} />
              </span>
            ))}
          </div>
          <div className="col g6">
            <h2 style={{ fontSize: 21, fontWeight: 700 }}>No active plan</h2>
            <p className="muted" style={{ textWrap: 'pretty' }}>
              Define your weekly structure once. Training Planner then generates progressive drafts for every week, with
              no limit ahead.
            </p>
          </div>
          <a className="btn p blk" href="#/plans/new">
            <Icon name="plus" size="s" />
            Create plan
          </a>
          <a className="btn s blk" href="#/settings">
            <Icon name="upload" size="s" />
            Import a backup
          </a>
        </div>
      </div>
    </>
  );
}
