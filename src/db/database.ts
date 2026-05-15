import Dexie from 'dexie';
import type { Table } from 'dexie';
import type { Tournament, Round, MatchResult } from '../domain/types';

interface TournamentRecord {
  id: string;
  name: string;
  currentRound: number;
  totalRounds: number;
  createdAt: number;
}

interface PlayerRecord {
  id: string;
  tournamentId: string;
  name: string;
  rating: number;
  seed: number;
  score: number;
  buchholz: number;
  progressive: number;
  sonnebornBerger: number;
}

interface RoundRecord {
  id: string;
  tournamentId: string;
  roundNumber: number;
  locked: boolean;
  strategy: string;
}

interface MatchRecord {
  id: string;
  roundId: string;
  teamA: string; // JSON
  teamB: string; // JSON
  boards?: string; // JSON
  result?: string; // JSON
}

class TournamentDatabase extends Dexie {
  tournaments!: Table<TournamentRecord>;
  players!: Table<PlayerRecord>;
  rounds!: Table<RoundRecord>;
  matches!: Table<MatchRecord>;

  constructor() {
    super('BughouseTournamentDB');
    this.version(5).stores({
      tournaments: 'id',
      players: 'id, tournamentId',
      rounds: 'id, tournamentId',
      matches: 'id, roundId',
    });
  }
}

export const db = new TournamentDatabase();

// ==================== 序列化 / 反序列化 ====================

export async function saveTournament(t: Tournament): Promise<void> {
  await db.transaction('rw', [db.tournaments, db.players, db.rounds, db.matches], async () => {
    await db.tournaments.put({
      id: t.id,
      name: t.name,
      currentRound: t.currentRound,
      totalRounds: t.totalRounds,
      createdAt: Date.now(),
    });

    await db.players.where('tournamentId').equals(t.id).delete();
    await db.players.bulkPut(
      t.players.map((p) => ({
        id: p.id,
        tournamentId: t.id,
        name: p.name,
        rating: p.rating,
        seed: p.seed,
        score: p.score,
        buchholz: p.buchholz,
        progressive: p.progressive,
        sonnebornBerger: p.sonnebornBerger,
      }))
    );

    await db.rounds.where('tournamentId').equals(t.id).delete();
    await db.matches.where('roundId').startsWith(t.id + '-round').delete();

    for (const round of t.rounds) {
      await db.rounds.put({
        id: round.id,
        tournamentId: t.id,
        roundNumber: round.roundNumber,
        locked: round.locked,
        strategy: round.strategy,
      });

      await db.matches.bulkPut(
        round.matches.map((m) => ({
          id: m.id,
          roundId: round.id,
          teamA: JSON.stringify(m.teamA),
          teamB: JSON.stringify(m.teamB),
          boards: m.boards ? JSON.stringify(m.boards) : undefined,
          result: m.result ? JSON.stringify(m.result) : undefined,
        }))
      );
    }
  });
}

export async function loadTournament(tournamentId: string): Promise<Tournament | null> {
  const tRec = await db.tournaments.get(tournamentId);
  if (!tRec) return null;

  const [playerRecs, roundRecs] = await Promise.all([
    db.players.where('tournamentId').equals(tournamentId).toArray(),
    db.rounds.where('tournamentId').equals(tournamentId).toArray(),
  ]);

  const rounds: Round[] = [];
  for (const rRec of roundRecs.sort((a, b) => a.roundNumber - b.roundNumber)) {
    const matchRecs = await db.matches.where('roundId').equals(rRec.id).toArray();
    rounds.push({
      id: rRec.id,
      roundNumber: rRec.roundNumber,
      locked: rRec.locked,
      strategy: rRec.strategy as 'manual' | 'semiAuto' | 'auto',
      matches: matchRecs.map((m) => ({
        id: m.id,
        teamA: JSON.parse(m.teamA),
        teamB: JSON.parse(m.teamB),
        boards: m.boards ? JSON.parse(m.boards) : undefined,
        result: m.result ? (JSON.parse(m.result) as MatchResult) : undefined,
      })),
    });
  }

  return {
    id: tRec.id,
    name: tRec.name,
    currentRound: tRec.currentRound,
    totalRounds: tRec.totalRounds ?? 0,
    players: playerRecs.map((p) => ({
      id: p.id,
      name: p.name,
      rating: p.rating,
      seed: p.seed ?? 0,
      score: p.score,
      buchholz: p.buchholz,
      progressive: p.progressive ?? 0,
      sonnebornBerger: p.sonnebornBerger ?? 0,
    })),
    rounds,
  };
}

export async function listTournaments(): Promise<{ id: string; name: string; createdAt: number }[]> {
  return db.tournaments.toArray();
}

export async function deleteTournament(tournamentId: string): Promise<void> {
  await db.transaction('rw', [db.tournaments, db.players, db.rounds, db.matches], async () => {
    await db.tournaments.delete(tournamentId);
    await db.players.where('tournamentId').equals(tournamentId).delete();
    const roundIds = await db.rounds.where('tournamentId').equals(tournamentId).primaryKeys();
    await db.rounds.where('tournamentId').equals(tournamentId).delete();
    for (const rid of roundIds) {
      await db.matches.where('roundId').equals(rid).delete();
    }
  });
}
