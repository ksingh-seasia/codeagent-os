import axios from "axios";

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:8000/api/v1",
  headers: {
    "Content-Type": "application/json",
  },
});

// Add auth token interceptor
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const api = {
  superAdmin: {
    getDashboard: async () => {
      const response = await apiClient.get("/super-admin/dashboard");
      return response.data;
    },
    getCompanies: async () => {
      const response = await apiClient.get("/super-admin/companies");
      return response.data;
    },
    createCompany: async (data: any) => {
      const response = await apiClient.post("/super-admin/companies", data);
      return response.data;
    },
    getCompany: async (id: number) => {
      const response = await apiClient.get(`/super-admin/companies/${id}`);
      return response.data;
    },
    updateCompany: async (params: { id: number, data: any }) => {
      const response = await apiClient.put(`/super-admin/companies/${params.id}`, params.data);
      return response.data;
    },
    deleteCompany: async (id: number) => {
      const response = await apiClient.delete(`/super-admin/companies/${id}`);
      return response.data;
    },
    getLicenses: async () => {
      const response = await apiClient.get("/super-admin/licenses");
      return response.data;
    },
    createLicense: async (data: any) => {
      const response = await apiClient.post("/super-admin/licenses", data);
      return response.data;
    },
    updateLicense: async (params: { id: number, data: any }) => {
      const response = await apiClient.put(`/super-admin/licenses/${params.id}`, params.data);
      return response.data;
    },
    deleteLicense: async (id: number) => {
      const response = await apiClient.delete(`/super-admin/licenses/${id}`);
      return response.data;
    },
    getUsers: async () => {
      const response = await apiClient.get("/super-admin/users");
      return response.data;
    },
    createUser: async (data: any) => {
      const response = await apiClient.post("/super-admin/users", data);
      return response.data;
    },
    updateUser: async (params: { id: number, data: any }) => {
      const response = await apiClient.put(`/super-admin/users/${params.id}`, params.data);
      return response.data;
    },
    deleteUser: async (id: number) => {
      const response = await apiClient.delete(`/super-admin/users/${id}`);
      return response.data;
    },
    getSettings: async () => {
      const response = await apiClient.get("/super-admin/settings");
      return response.data;
    },
    updateSettings: async (data: any) => {
      const response = await apiClient.put("/super-admin/settings", data);
      return response.data;
    },
    getEmailStatus: async () => {
      const response = await apiClient.get("/super-admin/settings/email-status");
      return response.data;
    },
    testEmail: async (email?: string) => {
      const response = await apiClient.post("/super-admin/settings/test-email", { email: email ?? null });
      return response.data;
    },
  },
};
