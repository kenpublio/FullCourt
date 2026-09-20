import api from './api';

export const scheduleService = {
  async autoSchedule(tournamentId, startDate, startTime) {
    const res = await api.post(`/tournaments/${tournamentId}/schedule/auto`, { start_date: startDate, start_time: startTime });
    return res.data;
  },

  async getSchedule(tournamentId) {
    const res = await api.get(`/tournaments/${tournamentId}/schedule`);
    return res.data?.data?.schedule || [];
  },

  async getConflicts(tournamentId) {
    const res = await api.post(`/tournaments/${tournamentId}/schedule/conflicts`, {});
    return res.data?.data || { court_clashes: [], team_clashes: [], venue_violations: [] };
  },

  async getConstraints(_tournamentId) {
    // Not a dedicated endpoint; derived from tournaments + schedule_constraints.
    return null;
  },

  async saveConstraints(tournamentId, constraints) {
    const res = await api.post(`/tournaments/${tournamentId}/schedule/constraints`, constraints);
    return res.data;
  },

  async updateSlot(matchId, start, courtId) {
    const res = await api.put(`/matches/${matchId}/slot`, { scheduled_start_time: start, court_id: courtId });
    return res.data;
  }
  ,async publish(tournamentId) {
    const res = await api.post(`/tournaments/${tournamentId}/schedule/publish`);
    return res.data;
  }
};

export default scheduleService;
