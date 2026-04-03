import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { User, LoginCredentials, RegisterCredentials } from '@/types';
import apiService from '@/services/api';

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null);
  const token = ref<string | null>(localStorage.getItem('auth_token'));
  const loading = ref(false);
  const error = ref<string | null>(null);

  const isAuthenticated = computed(() => !!token.value);
  const currentUser = computed(() => user.value);

  async function login(credentials: LoginCredentials) {
    loading.value = true;
    error.value = null;
    
    try {
      const response = await apiService.login(credentials);
      user.value = response.user;
      token.value = response.token;
      return response;
    } catch (err: any) {
      error.value = err.message || '登录失败';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function register(credentials: RegisterCredentials) {
    loading.value = true;
    error.value = null;
    
    try {
      const response = await apiService.register(credentials);
      user.value = response.user;
      token.value = response.token;
      return response;
    } catch (err: any) {
      error.value = err.message || '注册失败';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function logout() {
    await apiService.logout();
    user.value = null;
    token.value = null;
  }

  async function fetchCurrentUser() {
    if (!token.value) return;
    
    try {
      const response = await apiService.getCurrentUser();
      if (response.success && response.data) {
        user.value = response.data.user;
      }
    } catch (err) {
      // Token可能已过期
      await logout();
    }
  }

  function clearError() {
    error.value = null;
  }

  return {
    user,
    token,
    loading,
    error,
    isAuthenticated,
    currentUser,
    login,
    register,
    logout,
    fetchCurrentUser,
    clearError,
  };
});