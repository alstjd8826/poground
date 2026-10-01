import type {
  ClubRow,
  CoachRow,
  LineupRow,
  MatchRow,
  NewsRow,
  PlayerRow,
  StandingRow,
  VideoRow,
} from '@/repositories/kleague/rows'
import type {
  Club,
  FormResult,
  LineupPlayer,
  Match,
  MatchLineup,
  MatchSide,
  NewsArticle,
  Player,
  Standing,
  TeamLineup,
  VideoClip,
} from '@/models/kleague'

/**
 * DB 행 -> 도메인 모델.
 *
 * 스키마가 바뀌면 여기만 고친다. 화면은 컬럼명을 모른다.
 * 여기서 하는 일은 세 가지뿐이고, 그 이상의 판단은 각 서비스가 한다.
 *   1. 이름 바꾸기 (snake_case -> camelCase)
 *   2. 모양 바꾸기 (평평한 home_team_* -> 중첩된 home 객체)
 *   3. 타입 바꾸기 (문자열 -> Date, null -> 기본값)
 */

const EMBLEM_BASE = 'https://www.kleague.com/assets/images/emblem'

/** 구단 엠블럼은 team_id 로 조립한다. 별도 컬럼을 두지 않아도 되고 항상 최신이다. */
export function emblemUrlOf(teamId: string): string {
  return `${EMBLEM_BASE}/emblem_${teamId}@3x.png`
}

export function toMatch(row: MatchRow): Match {
  return {
    id: row.game_id,
    round: row.round_id,
    // 서버가 KST 오프셋(+09:00)을 붙여 저장하므로 Date 로 바로 읽힌다.
    // 모델은 밀리초로 든다 — Match.kickoffAtMs 주석 참고
    kickoffAtMs: new Date(row.kickoff_at).getTime(),
    status: row.status,
    home: {
      id: row.home_team_id,
      name: row.home_team_name,
      goal: row.home_goal,
      emblemUrl: emblemUrlOf(row.home_team_id),
    },
    away: {
      id: row.away_team_id,
      name: row.away_team_name,
      goal: row.away_goal,
      emblemUrl: emblemUrlOf(row.away_team_id),
    },
    stadium: row.field_name,
    broadcast: row.broadcast,
    attendance: row.audience_qty,
    ticketUrl: row.ticket_url,
    ticketVendor: row.ticket_company,
  }
}

const FORM_VALUES: FormResult[] = ['승', '무', '패']

export function toStanding(row: StandingRow): Standing {
  return {
    teamId: row.team_id,
    teamName: row.team_name,
    rank: row.rank,
    points: row.points,
    played: row.played,
    win: row.win,
    draw: row.draw,
    loss: row.loss,
    goalsFor: row.goals_for,
    goalsAgainst: row.goals_against,
    goalDiff: row.goal_diff,
    // 원본이 예상 밖의 문자열을 주면 버린다. 화면이 알 수 없는 값을 그리지 않도록.
    recentForm: (row.recent_form ?? []).filter((f): f is FormResult => FORM_VALUES.includes(f as FormResult)),
  }
}

export function toNewsArticle(row: NewsRow): NewsArticle {
  return {
    id: row.seq,
    category: row.category,
    clubTag: row.club_tag,
    title: row.title,
    publishedOn: row.published_on,
    viewCount: row.view_count,
  }
}

/**
 * 재생할 수 없는 영상은 아예 도메인에 들이지 않는다.
 * 그래서 VideoClip.youtubeId 는 non-null 이고, 화면에서 매번 확인하지 않아도 된다.
 */
export function toVideoClip(row: VideoRow): VideoClip | null {
  if (!row.youtube_id) return null
  return {
    id: row.seq,
    round: row.round_id,
    category: row.category,
    title: row.title,
    publishedOn: row.published_on,
    viewCount: row.view_count,
    youtubeId: row.youtube_id,
    thumbnailUrl: row.thumbnail_url ?? `https://i.ytimg.com/vi/${row.youtube_id}/hqdefault.jpg`,
  }
}

export function toVideoClips(rows: VideoRow[]): VideoClip[] {
  return rows.map(toVideoClip).filter((v): v is VideoClip => v !== null)
}

export function toPlayer(row: PlayerRow): Player {
  return {
    // 라인업에서 채워 넣기 전의 기본값. 스쿼드 API 는 이 셋을 주지 않는다
    playerId: null,
    position: null,
    name: row.name,
    backNo: row.back_no,
    // 기록은 없을 때 0 이 맞다. null 을 화면까지 들고 가면 표가 빈칸으로 남는다.
    appearances: row.appearances ?? 0,
    goals: row.goals ?? 0,
    assists: row.assists ?? 0,
    shots: row.shots ?? 0,
    fouls: row.fouls ?? 0,
    yellowCards: row.yellow_cards ?? 0,
    redCards: row.red_cards ?? 0,
    photoUrl: row.photo_url,
  }
}

export function toClub(row: ClubRow): Club {
  return {
    teamId: row.team_id,
    name: row.name,
    shortName: row.name_short,
    emblemUrl: row.emblem_url ?? emblemUrlOf(row.team_id),
    youtubeChannelId: row.youtube_channel_id,
    instagramUrl: row.instagram_url,
    facebookUrl: row.facebook_url,
    twitterUrl: row.twitter_url,
    homepage: row.homepage,
  }
}

/**
 * 라인업 행 -> 도메인.
 *
 * DB 의 lineup_order 를 order 로 되돌린다. 화면은 이 순서를 그대로 쓰므로
 * 여기서 다시 정렬하지 않는다 — 정렬은 리포지토리의 쿼리가 맡는다.
 */
export function toLineupPlayer(row: LineupRow): LineupPlayer {
  return {
    playerId: row.player_id,
    side: row.side,
    teamId: row.team_id,
    backNo: row.back_no,
    position: row.position,
    name: row.name,
    isCaptain: row.is_captain,
    isStarter: row.is_starter,
    order: row.lineup_order,
    records: row.records ?? [],
    substitutedAt: row.substituted_at,
    substitutedWith: row.substituted_with,
  }
}

/** 양 팀 라인업을 화면이 쓰는 모양으로 가른다 */
export function toMatchLineup(rows: LineupRow[], coaches: CoachRow[], match?: Match): MatchLineup {
  const players = rows.map(toLineupPlayer)
  const side = (s: MatchSide): TeamLineup => {
    const mine = players.filter(p => p.side === s)
    return {
      side: s,
      // 라인업이 비면 팀 코드를 알 길이 없으므로 경기에서 가져온다
      teamId: mine[0]?.teamId ?? (s === 'home' ? match?.home.id : match?.away.id) ?? '',
      coach: coaches.find(c => c.side === s)?.name ?? null,
      starters: mine.filter(p => p.isStarter),
      bench: mine.filter(p => !p.isStarter),
    }
  }
  return { home: side('home'), away: side('away') }
}
