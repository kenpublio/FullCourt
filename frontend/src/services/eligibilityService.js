import api from './api';

export const eligibilityService = {
  async getMyMembership() {
    const res = await api.get('/eligibility/me');
    return res.data?.data || { has_team: false, membership: null };
  },

  async getMyInvitations() {
    const res = await api.get('/eligibility/invitations');
    return res.data?.data?.invitations || [];
  },

  async respondToInvitation(invitationId, action) {
    const res = await api.put(`/eligibility/invitations/${invitationId}/respond`, { action });
    return res.data;
  },

  async getPendingPlayers() {
    const res = await api.get('/eligibility');
    return res.data?.data?.players || [];
  },

  async verifyPlayer(playerId, status, remarks) {
    const res = await api.put(`/eligibility/${playerId}`, { status, remarks });
    return res.data;
  },

  async updateRoster(playerId, jerseyNumber, position) {
    const res = await api.put(`/eligibility/${playerId}/roster`, { jersey_number: jerseyNumber, position });
    return res.data;
  },

  async addPlayer(playerData) {
    const res = await api.post('/eligibility/add-player', playerData);
    return res.data;
  }
  ,async documents(playerId) { return (await api.get(`/eligibility/${playerId}/documents`)).data?.data?.documents || []; }
  ,async uploadDocument(playerId, documentType, file) { const form=new FormData();form.append('document_type',documentType);form.append('document',file);return (await api.post(`/eligibility/${playerId}/documents`,form)).data; }
  ,async uploadIdentity(playerId,{idType,last4,idBirthDate,idFile,selfie,consent}) { const form=new FormData();form.append('document_type','Identity Verification');form.append('id_type',idType);form.append('id_number_last4',last4);form.append('id_birth_date',idBirthDate);form.append('consent_confirmed',consent?'1':'');form.append('document',idFile);form.append('selfie',selfie);return (await api.post(`/eligibility/${playerId}/documents`,form)).data; }
  ,async privateImage(id,selfie=false) { const path=selfie?`/eligibility/documents/${id}/selfie`:`/eligibility/documents/${id}/download`;const res=await api.get(path,{responseType:'blob'});return URL.createObjectURL(res.data); }
  ,async reviewDocument(id,status,notes='') { return (await api.put(`/eligibility/documents/${id}/review`,{status,notes})).data; }
};

export default eligibilityService;
