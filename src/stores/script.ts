import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { Script, ScriptGenerateRequest, ScriptHistoryResponse } from '@/types';
import apiService from '@/services/api';

export const useScriptStore = defineStore('script', () => {
  const scripts = ref<Script[]>([]);
  const currentScript = ref<Script | null>(null);
  const loading = ref(false);
  const generating = ref(false);
  const error = ref<string | null>(null);
  const pagination = ref({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  });

  const hasScripts = computed(() => scripts.value.length > 0);

  async function generateScript(request: ScriptGenerateRequest) {
    generating.value = true;
    error.value = null;
    
    try {
      const response = await apiService.generateScript(request);
      if (response.success && response.data) {
        currentScript.value = response.data.script;
        // 添加到历史列表开头
        scripts.value.unshift(response.data.script);
        return response.data.script;
      }
      throw new Error(response.error || '生成失败');
    } catch (err: any) {
      error.value = err.message || '剧本生成失败';
      throw err;
    } finally {
      generating.value = false;
    }
  }

  async function fetchHistory(page = 1, limit = 10) {
    loading.value = true;
    error.value = null;
    
    try {
      const response = await apiService.getScriptHistory(page, limit);
      if (response.success) {
        scripts.value = response.scripts;
        pagination.value = response.pagination;
      }
      return response;
    } catch (err: any) {
      error.value = err.message || '获取历史记录失败';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function fetchScript(id: number) {
    loading.value = true;
    error.value = null;
    
    try {
      const response = await apiService.getScript(id);
      if (response.success && response.data) {
        currentScript.value = response.data.script;
        return response.data.script;
      }
      throw new Error(response.error || '获取剧本失败');
    } catch (err: any) {
      error.value = err.message || '获取剧本详情失败';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function deleteScript(id: number) {
    try {
      const response = await apiService.deleteScript(id);
      if (response.success) {
        scripts.value = scripts.value.filter(s => s.id !== id);
        if (currentScript.value?.id === id) {
          currentScript.value = null;
        }
      }
      return response;
    } catch (err: any) {
      error.value = err.message || '删除失败';
      throw err;
    }
  }

  function clearCurrentScript() {
    currentScript.value = null;
  }

  function clearError() {
    error.value = null;
  }

  return {
    scripts,
    currentScript,
    loading,
    generating,
    error,
    pagination,
    hasScripts,
    generateScript,
    fetchHistory,
    fetchScript,
    deleteScript,
    clearCurrentScript,
    clearError,
  };
});