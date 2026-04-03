<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useToast } from '@/composables/useToast';
import apiService from '@/services/api';
import type { AIConfig, AIService } from '@/types';

const props = defineProps<{
  isOpen: boolean;
  service: AIService | null;
  config: AIConfig | null;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'saved'): void;
}>();

const toast = useToast();

const apiKey = ref('');
const baseUrl = ref('');
const model = ref('');
const testing = ref(false);
const saving = ref(false);
const testStatus = ref<'idle' | 'success' | 'error'>('idle');
const testMessage = ref('');

watch(() => props.isOpen, (newVal) => {
  if (newVal && props.service) {
    apiKey.value = '';
    baseUrl.value = props.config?.base_url || props.service.defaultBaseUrl || '';
    model.value = props.config?.model || props.service.defaultModel || '';
    testStatus.value = 'idle';
    testMessage.value = props.config?.last_check_message || '';
  }
});

const validationLabel = computed(() => {
  const status = props.config?.validation_status;
  if (status === 'passed') return '已检测通过';
  if (status === 'failed') return '检测未通过';
  return '待检测';
});

function formatDate(value?: string | null) {
  if (!value) return '未检测';
  return new Date(value).toLocaleString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

async function testConnection() {
  if (!props.service) return;

  testing.value = true;
  testStatus.value = 'idle';
  testMessage.value = '';

  try {
    const response = await apiService.testAIConnection({
      serviceName: props.service.id,
      apiKey: apiKey.value || undefined,
      baseUrl: baseUrl.value || undefined,
      model: model.value || undefined,
    });

    testStatus.value = response.success ? 'success' : 'error';
    testMessage.value = response.message || (response.success ? '检测通过' : '检测失败');

    if (response.data?.resolvedBaseUrl) {
      baseUrl.value = response.data.resolvedBaseUrl;
    }

    if (response.data?.resolvedModel) {
      model.value = response.data.resolvedModel;
    }

    if (response.success) {
      toast.success('渠道检测通过');
      emit('saved'); // Refresh parent data
    } else {
      toast.error(testMessage.value);
    }
  } catch (error: any) {
    testStatus.value = 'error';
    testMessage.value = error.message || '检测失败';
    toast.error(testMessage.value);
  } finally {
    testing.value = false;
  }
}

async function saveConfig() {
  if (!props.service) return;

  saving.value = true;

  try {
    const response = await apiService.updateAIConfig({
      serviceName: props.service.id,
      apiKey: apiKey.value || undefined,
      baseUrl: baseUrl.value || undefined,
      model: model.value || undefined,
    });

    if (!response.success) {
      throw new Error(response.message || '保存失败');
    }

    toast.success(response.message || '配置已保存');
    emit('saved');
    emit('close');
  } catch (error: any) {
    toast.error(error.message || '保存失败');
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
    <!-- Backdrop -->
    <div class="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" @click="emit('close')"></div>

    <!-- Modal Panel -->
    <div class="relative w-full max-w-2xl transform overflow-hidden rounded-2xl bg-[#191919] border border-[#2F2F2F] shadow-2xl transition-all flex flex-col max-h-[90vh]">
      <!-- Header -->
      <div class="px-6 py-4 border-b border-[#2F2F2F] flex items-center justify-between shrink-0">
        <div class="flex items-center gap-3">
          <h3 class="text-lg font-semibold text-white">{{ service?.name }} 配置</h3>
          <div :class="['inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] border', 
            config?.validation_status === 'passed' ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20' : 
            config?.validation_status === 'failed' ? 'text-red-300 bg-red-500/10 border-red-500/20' : 
            'text-amber-200 bg-amber-500/10 border-amber-500/20']">
            <span class="w-1.5 h-1.5 rounded-full" :class="config?.validation_status === 'passed' ? 'bg-emerald-400' : config?.validation_status === 'failed' ? 'bg-red-400' : 'bg-amber-300'"></span>
            {{ validationLabel }}
          </div>
        </div>
        <button @click="emit('close')" class="text-[#737373] hover:text-white transition-colors">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Content -->
      <div class="p-6 overflow-y-auto">
        <div class="grid md:grid-cols-[1.2fr_0.8fr] gap-6">
          <div class="space-y-4">
            <div>
              <p class="text-sm text-[#737373] leading-6">
                {{ service?.requiresApiKey ? '请填写完整的 API Key、Base URL 与模型名称。检测会发起真实请求，确保鉴权、模型和端点都可用。' : '该渠道由 Cloudflare Workers AI 直接提供，无需额外密钥，但仍建议先执行检测。' }}
              </p>
            </div>

            <div v-if="service?.requiresApiKey">
              <label class="block text-xs text-[#A3A3A3] mb-2 uppercase tracking-[0.18em]">API Key</label>
              <input
                v-model="apiKey"
                type="password"
                class="input-field bg-[#141414] font-mono"
                :placeholder="service?.apiKeyFormat || '输入 API Key'"
              />
            </div>

            <div v-if="service?.requiresBaseUrl">
              <label class="block text-xs text-[#A3A3A3] mb-2 uppercase tracking-[0.18em]">Base URL</label>
              <input
                v-model="baseUrl"
                type="text"
                class="input-field bg-[#141414]"
                :placeholder="service?.defaultBaseUrl || 'https://.../v1'"
              />
            </div>

            <div v-if="service?.requiresModel">
              <label class="block text-xs text-[#A3A3A3] mb-2 uppercase tracking-[0.18em]">模型名称</label>
              <input
                v-model="model"
                type="text"
                class="input-field bg-[#141414]"
                :placeholder="service?.defaultModel || '输入模型名'"
              />
            </div>
          </div>

          <div class="rounded-2xl border border-[#2F2F2F] bg-[#141414] p-4 space-y-4">
            <div>
              <div class="text-xs text-[#737373] uppercase tracking-[0.18em] mb-2">当前状态</div>
              <div class="text-lg font-medium text-white">{{ validationLabel }}</div>
            </div>

            <div class="space-y-2 text-sm">
              <div class="flex justify-between gap-4">
                <span class="text-[#737373]">最近检测</span>
                <span class="text-[#E5E5E5] text-right">{{ formatDate(config?.last_checked_at) }}</span>
              </div>
              <div class="flex justify-between gap-4">
                <span class="text-[#737373]">已保存 Base URL</span>
                <span class="text-[#E5E5E5] text-right break-all">{{ config?.base_url || service?.defaultBaseUrl || '—' }}</span>
              </div>
              <div class="flex justify-between gap-4">
                <span class="text-[#737373]">已保存模型</span>
                <span class="text-[#E5E5E5] text-right break-all">{{ config?.model || service?.defaultModel || '—' }}</span>
              </div>
            </div>

            <div class="rounded-xl border border-[#2F2F2F] bg-black/20 p-3 text-sm text-[#CFCFCF] leading-6 min-h-[112px]">
              {{ testStatus !== 'idle' ? testMessage : config?.last_check_message || '保存后会标记为待检测；检测通过后才能更放心地用于生成。' }}
            </div>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="px-6 py-4 border-t border-[#2F2F2F] bg-[#141414] flex items-center justify-between shrink-0">
        <button
          @click="testConnection"
          :disabled="testing || (service?.requiresApiKey && !apiKey) || (service?.requiresBaseUrl && !baseUrl) || (service?.requiresModel && !model)"
          class="btn-secondary flex items-center gap-2"
        >
          <span v-if="testing" class="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></span>
          <span>{{ testing ? '检测中...' : '严格检测渠道' }}</span>
        </button>

        <div class="flex gap-3">
          <button @click="emit('close')" class="px-4 py-2 rounded-xl text-sm font-medium text-[#A3A3A3] hover:text-white transition-colors">
            取消
          </button>
          <button
            @click="saveConfig"
            :disabled="saving"
            class="btn-primary flex items-center gap-2"
          >
            <span v-if="saving" class="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></span>
            <span>{{ saving ? '保存中...' : '保存并设为当前渠道' }}</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>