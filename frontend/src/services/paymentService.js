import api from './api';

export const paymentService = {
  async getPayments() {
    const res = await api.get('/payments');
    return res.data?.data?.payments || [];
  },

  async submitPayment(paymentData) {
    const res = await api.post('/payments', paymentData);
    return res.data;
  },

  async verifyPayment(paymentId, status, remarks) {
    const res = await api.put(`/payments/${paymentId}/verify`, { status, remarks });
    return res.data;
  },

  async uploadReceipt(paymentId, file) {
    const formData = new FormData();
    formData.append('receipt', file);
    const res = await api.post(`/payments/${paymentId}/receipt`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return res.data;
  }
};

export default paymentService;
