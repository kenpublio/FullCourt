import api from './api';

export const attendanceService = {
  async scanQR(matchId, qrPayload, playerIds = [], syncUuid = crypto.randomUUID()) {
    const res = await api.post('/attendance/scan', { match_id: matchId, qr_payload: qrPayload, player_ids: playerIds, sync_uuid: syncUuid });
    return res.data;
  },

  async getTeamQR(teamId) { return (await api.get(`/teams/${teamId}/qr`)).data?.data?.team; },
  async issueOfficialQR(assignmentId) { return (await api.post(`/game-assignments/${assignmentId}/access-qr`)).data?.data?.access; },
  async validateOfficialQR(matchId, qrPayload) { return (await api.post('/game-access/validate', { match_id:matchId, qr_payload:qrPayload })).data; },

  async getMatchAttendance(matchId) {
    const res = await api.get(`/matches/${matchId}/attendance`);
    return res.data?.data?.attendance || [];
  }
};

export default attendanceService;
