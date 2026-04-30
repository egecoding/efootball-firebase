export type TournamentStatus = 'draft' | 'open' | 'in_progress' | 'completed'
export type TournamentFormat = 'knockout' | 'round_robin' | 'league' | 'group_knockout' | 'double_elimination' | 'champions_league'
export type MatchStatus =
  | 'pending'
  | 'scheduled'
  | 'awaiting_confirmation'
  | 'completed'
  | 'walkover'

// ─── Database row types ────────────────────────────────────────────────────

export interface Profile {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  wins: number
  losses: number
  is_super_admin: boolean
  created_at: string
  updated_at: string
}

export interface Tournament {
  id: string
  organizer_id: string
  title: string
  description: string | null
  game_name: string
  max_participants: number
  status: TournamentStatus
  format: TournamentFormat
  invite_code: string
  is_public: boolean
  starts_at: string | null
  created_at: string
  updated_at: string
}

export interface Participant {
  id: string
  tournament_id: string
  user_id: string | null
  name: string | null
  seed: number | null
  joined_at: string
}

export interface Round {
  id: string
  tournament_id: string
  round_number: number
  round_name: string
}

export interface Match {
  id: string
  tournament_id: string
  round_id: string
  match_number: number
  player1_id: string | null
  player2_id: string | null
  player1_score: number | null
  player2_score: number | null
  winner_id: string | null
  status: MatchStatus
  player1_name: string | null
  player2_name: string | null
  screenshot_url: string | null
  submitted_by: string | null
  next_match_id: string | null
  next_match_slot: 1 | 2 | null
  played_at: string | null
  created_at: string
  updated_at: string
}

export interface ResultSubmission {
  id: string
  match_id: string
  submitted_by: string
  player1_score: number
  player2_score: number
  screenshot_url: string | null
  created_at: string
}

// ─── Joined / enriched types ───────────────────────────────────────────────

export interface TournamentWithOrganizer extends Tournament {
  profiles: Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url'>
  participant_count?: number
}

export interface ParticipantWithProfile extends Participant {
  profiles: Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url'> | null
}

export interface MatchWithPlayers extends Match {
  player1?: Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url'> | null
  player2?: Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url'> | null
  winner?: Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url'> | null
  rounds?: Pick<Round, 'round_number' | 'round_name'>
}

export interface RoundWithMatches extends Round {
  matches: MatchWithPlayers[]
}

// ─── Database type for Supabase client generics ────────────────────────────

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile
        Insert: Omit<Profile, 'created_at' | 'updated_at' | 'wins' | 'losses'> &
          Partial<Pick<Profile, 'wins' | 'losses' | 'created_at' | 'updated_at'>>
        Update: Partial<Omit<Profile, 'id' | 'created_at'>>
      }
      tournaments: {
        Row: Tournament
        Insert: Omit<Tournament, 'id' | 'invite_code' | 'created_at' | 'updated_at' | 'status'> &
          Partial<Pick<Tournament, 'id' | 'invite_code' | 'status'>>
        Update: Partial<Omit<Tournament, 'id' | 'created_at'>>
      }
      participants: {
        Row: Participant
        Insert: Omit<Participant, 'id' | 'joined_at' | 'seed' | 'user_id' | 'name'> &
          Partial<Pick<Participant, 'id' | 'seed' | 'user_id' | 'name'>>
        Update: Partial<Omit<Participant, 'id' | 'joined_at'>>
      }
      rounds: {
        Row: Round
        Insert: Omit<Round, 'id'> & Partial<Pick<Round, 'id'>>
        Update: Partial<Omit<Round, 'id'>>
      }
      matches: {
        Row: Match
        Insert: Omit<Match, 'id' | 'created_at' | 'updated_at'> &
          Partial<Pick<Match, 'id' | 'created_at' | 'updated_at'>>
        Update: Partial<Omit<Match, 'id' | 'created_at'>>
      }
      result_submissions: {
        Row: ResultSubmission
        Insert: Omit<ResultSubmission, 'id' | 'created_at'> &
          Partial<Pick<ResultSubmission, 'id'>>
        Update: Partial<Omit<ResultSubmission, 'id' | 'created_at' | 'match_id' | 'submitted_by'>>
      }
    }
    Views: Record<string, never>
    Functions: {
      increment_wins: { Args: { uid: string }; Returns: void }
      increment_losses: { Args: { uid: string }; Returns: void }
    }
    Enums: {
      tournament_status: TournamentStatus
      match_status: MatchStatus
    }
  }
}
