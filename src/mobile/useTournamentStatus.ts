import { computed } from 'vue';
import { useTournamentStore } from '../stores/tournament';

export type MobileTournamentStatus =
  | 'setup'
  | 'ready'
  | 'in_progress'
  | 'round_completed'
  | 'completed';

export type MobileNextAction = {
  label: string;
  target: 'setup' | 'pairing' | 'scores';
  action?: 'startRound';
};

export function useTournamentStatus() {
  const store = useTournamentStore();

  const playerCount = computed(() => store.tournament?.players.length ?? 0);
  const currentRoundNumber = computed(() => store.tournament?.currentRound ?? 0);
  const totalRounds = computed(() => store.tournament?.totalRounds ?? 0);

  const currentRoundMatches = computed(() => store.currentRoundObj?.matches ?? []);
  const completedMatches = computed(() =>
    currentRoundMatches.value.filter((match) => !!match.result).length
  );

  const hasCurrentRound = computed(() => !!store.currentRoundObj);
  const currentRoundComplete = computed(() => {
    const matches = currentRoundMatches.value;
    return matches.length > 0 && matches.every((match) => !!match.result);
  });

  const allRoundsFinished = computed(() => {
    const tournament = store.tournament;
    if (!tournament || tournament.totalRounds === 0) return false;
    return (
      tournament.rounds.length >= tournament.totalRounds &&
      tournament.rounds.every((round) => round.locked)
    );
  });

  const status = computed<MobileTournamentStatus>(() => {
    if (!store.tournament || playerCount.value < 4) return 'setup';
    if (allRoundsFinished.value) return 'completed';
    if (!hasCurrentRound.value) return 'ready';
    if (currentRoundComplete.value || store.currentRoundLocked) return 'round_completed';
    return 'in_progress';
  });

  const statusLabel = computed(() => {
    switch (status.value) {
      case 'setup':
        return 'Setup';
      case 'ready':
        return 'Ready to pair';
      case 'in_progress':
        return 'Results needed';
      case 'round_completed':
        return 'Round complete';
      case 'completed':
        return 'Tournament completed';
      default:
        return 'Setup';
    }
  });

  const nextAction = computed<MobileNextAction>(() => {
    switch (status.value) {
      case 'setup':
        return { label: store.tournament ? 'Manage Players' : 'Create Tournament', target: 'setup' };
      case 'ready':
        return { label: 'Generate Round 1', target: 'pairing', action: 'startRound' };
      case 'in_progress':
        return { label: 'Enter Results', target: 'pairing' };
      case 'round_completed':
        if (currentRoundNumber.value >= totalRounds.value) {
          return { label: 'View Final Standings', target: 'scores' };
        }
        return { label: 'Generate Next Round', target: 'pairing', action: 'startRound' };
      case 'completed':
        return { label: 'View Final Podium', target: 'scores' };
      default:
        return { label: 'Create Tournament', target: 'setup' };
    }
  });

  return {
    store,
    playerCount,
    currentRoundNumber,
    totalRounds,
    completedMatches,
    totalMatches: computed(() => currentRoundMatches.value.length),
    status,
    statusLabel,
    nextAction,
  };
}
