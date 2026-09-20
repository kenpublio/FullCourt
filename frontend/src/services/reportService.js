import api from './api';

export const reportService = {
  async getAnalytics() {
    const res = await api.get('/analytics/dashboard');
    return res.data?.data || {};
  },
  async getStandings(tournamentId) {
    const res = await api.get(`/tournaments/${tournamentId}/standings`);
    return res.data?.data?.standings || [];
  },
  async generateReport(payload) {
    const res = await api.post('/reports/generate', payload);
    return res.data;
  },
  async getReportLog() {
    const res = await api.get('/reports/log');
    return res.data?.data?.reports || [];
  }
  ,async downloadTournamentPdf(tournamentId) {
    const res = await api.get(`/reports/tournaments/${tournamentId}.pdf`, { responseType: 'blob' });
    return res.data;
  }
  ,async downloadScoreSheet(matchId) {
    const res = await api.get(`/reports/matches/${matchId}/score-sheet.pdf`, { responseType: 'blob' });
    return res.data;
  }
};

export default reportService;
