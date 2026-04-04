<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useToast } from '@/composables/useToast';
import apiService from '@/services/api';
import type { AIConfig, AIService } from '@/types';

const toast = useToast();

const aiServices = ref<AIService[]>([]);
const configs = ref<AIConfig[]>([]);
const selectedService = ref<string>('cloudflare-ai');
const apiKey = ref('');
const baseUrl = ref('');
const model = ref('');
const loading = ref(true);
const testing = ref(false);
const saving = ref(false);
const testStatus = ref<'idle' | 'success' | 'error'>('idle');
const testMessage = ref('');
const modalOpen = ref(false);

const serviceToneMap: Record<string, string> = {
  'cloudflare-ai': 'from-orange-500/20 via-amber-500/10 to-transparent border-orange-500/30',
  deepseek: 'from-blue-500/20 via-cyan-500/10 to-transparent border-blue-500/30',
  qwen: 'from-fuchsia-500/20 via-violet-500/10 to-transparent border-fuchsia-500/30',
  zhipu: 'from-emerald-500/20 via-green-500/10 to-transparent border-emerald-500/30',
  kimi: 'from-sky-500/20 via-indigo-500/10 to-transparent border-sky-500/30',
  doubao: 'from-rose-500/20 via-orange-500/10 to-transparent border-rose-500/30',
  siliconflow: 'from-teal-500/20 via-cyan-500/10 to-transparent border-teal-500/30',
  openai: 'from-emerald-500/20 via-teal-500/10 to-transparent border-emerald-500/30',
  claude: 'from-amber-500/20 via-yellow-500/10 to-transparent border-amber-500/30',
};

const selectedServiceMeta = computed(() =>
  aiServices.value.find((service) => service.id === selectedService.value) ?? null,
);

const activeConfig = computed(() =>
  configs.value.find((config) => config.service_name === selectedService.value) ?? null,
);

const activeServiceName = computed(() => {
  const config = configs.value.find((item) => item.is_active);
  return aiServices.value.find((service) => service.id === config?.service_name)?.name ?? 'Cloudflare Workers AI';
});

const totalConfiguredServices = computed(() => configs.value.length);

const passedServices = computed(() =>
  configs.value.filter((config) => config.validation_status === 'passed').length,
);

const failedServices = computed(() =>
  configs.value.filter((config) => config.validation_status === 'failed').length,
);

const pendingServices = computed(() =>
  aiServices.value.length - passedServices.value - failedServices.value,
);

const healthyServices = computed(() =>
  configs.value.filter((config) => config.validation_status === 'passed').map((config) => config.service_name),
);

const selectedValidationTone = computed(() => {
  const status = activeConfig.value?.validation_status;
  if (status === 'passed') return 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20';
  if (status === 'failed') return 'text-red-300 bg-red-500/10 border-red-500/20';
  return 'text-amber-200 bg-amber-500/10 border-amber-500/20';
});

const selectedValidationLabel = computed(() => {
  const status = activeConfig.value?.validation_status;
  if (status === 'passed') return '已检测通过';
  if (status === 'failed') return '检测未通过';
  return '待检测';
});

const statusTimeline = computed(() => {
  const items: Array<{ title: string; value: string; tone: string }> = [
    {
      title: '渠道已选中',
      value: selectedServiceMeta.value?.name || '未选择',
      tone: 'bg-blue-400',
    },
    {
      title: '最近保存配置',
      value: activeConfig.value?.created_at ? formatDate(activeConfig.value.created_at) : '尚未保存',
      tone: activeConfig.value?.created_at ? 'bg-sky-400' : 'bg-[#555]',
    },
    {
      title: '最近检测结果',
      value: activeConfig.value?.last_check_message || '尚无检测记录',
      tone: activeConfig.value?.validation_status === 'passed' ? 'bg-emerald-400' : activeConfig.value?.validation_status === 'failed' ? 'bg-red-400' : 'bg-amber-300',
    },
    {
      title: '最近检测时间',
      value: activeConfig.value?.last_checked_at ? formatDate(activeConfig.value.last_checked_at) : '未检测',
      tone: activeConfig.value?.last_checked_at ? 'bg-violet-400' : 'bg-[#555]',
    },
  ];

  return items;
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

function getServiceOperationalStatus(serviceId: string) {
  const config = configs.value.find((item) => item.service_name === serviceId);
  if (!config) return { label: '未配置', tone: 'text-[#A3A3A3] bg-[#2F2F2F]/80 border-[#404040]' };
  if (config.validation_status === 'passed') return { label: '可用于生产', tone: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20' };
  if (config.validation_status === 'failed') return { label: '需修复', tone: 'text-red-300 bg-red-500/10 border-red-500/20' };
  return { label: '待检测', tone: 'text-amber-200 bg-amber-500/10 border-amber-500/20' };
}

function applyConfigForService(
  serviceId: string,
  options: {
    preserveApiKey?: boolean;
    preserveBaseUrl?: boolean;
    preserveModel?: boolean;
  } = {},
) {
  const service = aiServices.value.find((item) => item.id === serviceId);
  const config = configs.value.find((item) => item.service_name === serviceId);

  selectedService.value = serviceId;
  if (!options.preserveApiKey) {
    apiKey.value = '';
  }
  if (!options.preserveBaseUrl) {
    baseUrl.value = config?.base_url || service?.defaultBaseUrl || '';
  }
  if (!options.preserveModel) {
    model.value = config?.model || service?.defaultModel || '';
  }
  testStatus.value = 'idle';
  testMessage.value = config?.last_check_message || '';
}

async function loadSettings() {
  loading.value = true;

  try {
    const [serviceResponse, configResponse] = await Promise.all([
      apiService.getAIServices(),
      apiService.getAIConfig(),
    ]);

    aiServices.value = serviceResponse.data?.services || [];
    configs.value = configResponse.data?.configs || [];

    const active = configs.value.find((item) => item.is_active)?.service_name;
    const fallback = aiServices.value.find((item) => item.isDefault)?.id || aiServices.value[0]?.id || 'cloudflare-ai';
    applyConfigForService(active || fallback);
  } catch (error: any) {
    toast.error(error.message || '加载设置失败');
  } finally {
    loading.value = false;
  }
}

function openServiceModal(serviceId: string) {
  applyConfigForService(serviceId);
  modalOpen.value = true;
}

function closeModal() {
  modalOpen.value = false;
}

function resetBaseUrlToDefault() {
  baseUrl.value = selectedServiceMeta.value?.defaultBaseUrl || '';
}

function resetModelToDefault() {
  model.value = selectedServiceMeta.value?.defaultModel || '';
}

async function copyText(value?: string) {
  if (!value) {
    toast.info('当前没有可复制的默认值');
    return;
  }

  try {
    await navigator.clipboard.writeText(value);
    toast.success('已复制默认值');
  } catch {
    toast.error('复制失败，请手动复制');
  }
}

async function testConnection() {
  if (!selectedServiceMeta.value) return;

  const targetServiceId = selectedService.value;
  const currentApiKey = apiKey.value;
  testing.value = true;
  testStatus.value = 'idle';
  testMessage.value = '';

  try {
    const response = await apiService.testAIConnection({
      serviceName: selectedService.value,
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

    await loadSettings();
    applyConfigForService(targetServiceId, {
      preserveApiKey: true,
      preserveBaseUrl: true,
      preserveModel: true,
    });
    apiKey.value = currentApiKey;

    if (response.success) {
      toast.success('渠道检测通过');
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
  if (!selectedServiceMeta.value) return;

  const targetServiceId = selectedService.value;
  saving.value = true;

  try {
    const response = await apiService.updateAIConfig({
      serviceName: selectedService.value,
      apiKey: apiKey.value || undefined,
      baseUrl: baseUrl.value || undefined,
      model: model.value || undefined,
    });

    if (!response.success) {
      throw new Error(response.message || '保存失败');
    }

    toast.success(response.message || '配置已保存');
    apiKey.value = '';
    await loadSettings();
    applyConfigForService(targetServiceId);
    modalOpen.value = false;
  } catch (error: any) {
    toast.error(error.message || '保存失败');
  } finally {
    saving.value = false;
  }
}

onMounted(loadSettings);
</script>

<template>
  <div class="min-h-full bg-[#191919] text-[#EBEBEB]">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-10">
      <div v-if="loading" class="py-20 flex justify-center">
        <div class="animate-spin rounded-full h-10 w-10 border-b-2 border-[#2563EB]"></div>
      </div>

      <template v-else>
        <section class="relative overflow-hidden rounded-3xl border border-[#2F2F2F] bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.18),transparent_35%),linear-gradient(135deg,#202020_0%,#161616_100%)] p-6 lg:p-8 mb-8">
          <div class="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:28px_28px] opacity-30"></div>
          <div class="relative grid lg:grid-cols-[1.6fr_1fr] gap-6 items-end">
            <div>
              <div class="inline-flex items-center gap-2 rounded-full border border-[#3B82F6]/30 bg-[#2563EB]/10 px-3 py-1 text-xs text-[#93C5FD] mb-4">
                AI Infrastructure Console
              </div>
              <div class="text-[11px] uppercase tracking-[0.18em] text-[#666] mb-2">Operations / Runtime Readiness</div>
              <h1 class="text-3xl lg:text-4xl font-semibold text-white tracking-tight mb-3">统一管理生成基础设施、默认渠道与运行健康度</h1>
              <p class="text-sm lg:text-base text-[#A3A3A3] max-w-2xl leading-7">
                这里不只是“填模型参数”，而是整个创作平台的 AI 运行台：你可以判断哪些渠道可直接投入生产，哪些渠道仍待检测，以及当前默认执行策略是什么。
              </p>
            </div>

            <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div class="rounded-2xl border border-[#2F2F2F] bg-black/20 p-4">
                <div class="text-[11px] uppercase tracking-[0.18em] text-[#737373] mb-1">当前激活</div>
                <div class="text-sm font-medium text-white leading-6">{{ activeServiceName }}</div>
              </div>
              <div class="rounded-2xl border border-[#2F2F2F] bg-black/20 p-4">
                <div class="text-[11px] uppercase tracking-[0.18em] text-[#737373] mb-1">已配置渠道</div>
                <div class="text-2xl font-semibold text-white">{{ totalConfiguredServices }}</div>
              </div>
              <div class="rounded-2xl border border-[#2F2F2F] bg-black/20 p-4">
                <div class="text-[11px] uppercase tracking-[0.18em] text-[#737373] mb-1">检测通过</div>
                <div class="text-2xl font-semibold text-emerald-300">{{ passedServices }}</div>
              </div>
              <div class="rounded-2xl border border-[#2F2F2F] bg-black/20 p-4">
                <div class="text-[11px] uppercase tracking-[0.18em] text-[#737373] mb-1">待处理</div>
                <div class="text-2xl font-semibold text-amber-300">{{ failedServices + pendingServices }}</div>
              </div>
            </div>
          </div>
        </section>

        <div class="grid xl:grid-cols-[1.1fr,0.9fr] gap-4 mb-8">
          <div class="card !p-5">
            <div class="flex items-center justify-between mb-4">
              <div>
                <div class="text-[11px] uppercase tracking-[0.18em] text-[#666] mb-1">默认生产策略</div>
                <div class="text-base font-semibold text-white">{{ activeServiceName }}</div>
              </div>
              <span class="px-2 py-1 rounded-full text-[11px] border" :class="selectedValidationTone">{{ selectedValidationLabel }}</span>
            </div>
            <div class="space-y-3 text-sm text-[#A3A3A3]">
              <div class="flex items-center justify-between gap-4">
                <span>当前默认渠道</span>
                <span class="text-white text-right">{{ activeServiceName }}</span>
              </div>
              <div class="flex items-center justify-between gap-4">
                <span>推荐状态</span>
                <span class="text-white text-right">{{ passedServices > 0 ? '优先使用检测通过的渠道' : '先完成至少一个渠道检测' }}</span>
              </div>
              <div class="flex items-center justify-between gap-4">
                <span>最近检测</span>
                <span class="text-white text-right">{{ activeConfig?.last_checked_at ? formatDate(activeConfig?.last_checked_at) : '暂无记录' }}</span>
              </div>
            </div>
          </div>

          <div class="card !p-5">
            <div class="flex items-center justify-between mb-4">
              <div>
                <div class="text-[11px] uppercase tracking-[0.18em] text-[#666] mb-1">渠道健康总览</div>
                <div class="text-base font-semibold text-white">{{ aiServices.length }} 个可接入渠道</div>
              </div>
              <span class="text-[11px] text-[#737373]">生产可用 {{ healthyServices.length }} 个</span>
            </div>
            <div class="flex flex-wrap gap-2">
              <span v-for="service in aiServices" :key="service.id" :class="['px-2.5 py-1 rounded-full border text-[11px]', getServiceOperationalStatus(service.id).tone]">
                {{ service.name }} · {{ getServiceOperationalStatus(service.id).label }}
              </span>
            </div>
          </div>
        </div>

        <div class="card !p-0 overflow-hidden">
          <div class="px-6 py-5 border-b border-[#2F2F2F] flex items-center justify-between gap-4 flex-wrap">
            <div>
              <div class="text-[11px] uppercase tracking-[0.18em] text-[#666] mb-1">Channel Operations</div>
              <h2 class="text-xl font-semibold text-white">运行渠道</h2>
              <p class="text-sm text-[#737373] mt-1">点击卡片进入弹框配置。主页面用于判断渠道健康度、默认执行策略与可生产状态。</p>
            </div>
            <div :class="['inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs border', selectedValidationTone]">
              <span class="w-2 h-2 rounded-full" :class="activeConfig?.validation_status === 'passed' ? 'bg-emerald-400' : activeConfig?.validation_status === 'failed' ? 'bg-red-400' : 'bg-amber-300'"></span>
              {{ selectedValidationLabel }}
            </div>
          </div>

          <div class="p-5 grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
            <button
              v-for="service in aiServices"
              :key="service.id"
              type="button"
              @click="openServiceModal(service.id)"
              :class="[
                'rounded-2xl border p-5 text-left transition-all bg-gradient-to-br hover:translate-y-[-2px]',
                configs.find((item) => item.is_active && item.service_name === service.id) ? 'border-[#60A5FA] shadow-[0_0_0_1px_rgba(96,165,250,0.25)]' : 'border-[#2F2F2F] hover:border-[#404040]',
                serviceToneMap[service.id] || 'from-white/5 to-transparent border-[#2F2F2F]'
              ]"
            >
              <div class="flex items-start justify-between gap-3 mb-3">
                <div>
                  <div class="text-sm font-medium text-white">{{ service.name }}</div>
                  <div class="text-[11px] text-[#737373] mt-1">{{ service.protocol === 'openai-compatible' ? 'OpenAI 兼容' : service.protocol === 'anthropic' ? 'Anthropic 官方' : 'Cloudflare 内置' }}</div>
                </div>
                <div class="flex items-center gap-2">
                  <div v-if="configs.find((item) => item.service_name === service.id)?.validation_status === 'passed'" class="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.7)]"></div>
                  <svg class="w-4 h-4 text-[#808080]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>

              <p class="text-xs leading-6 text-[#BDBDBD] min-h-[48px]">{{ service.description }}</p>

              <div class="mt-4 flex items-center justify-between gap-3 text-xs">
                <span :class="['px-2 py-1 rounded-full border', getServiceOperationalStatus(service.id).tone]">{{ getServiceOperationalStatus(service.id).label }}</span>
                <span class="text-[#CFCFCF]">{{ formatDate(configs.find((item) => item.service_name === service.id)?.last_checked_at) }}</span>
              </div>
              <div class="mt-3 text-[11px] text-[#8D8D8D] leading-6">
                {{ configs.find((item) => item.service_name === service.id)?.last_check_message || '点击查看与配置' }}
              </div>
            </button>
          </div>
        </div>

        <Teleport to="body">
          <div v-if="modalOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div class="absolute inset-0 bg-black/70 backdrop-blur-sm" @click="closeModal"></div>
            <div class="relative w-full max-w-3xl rounded-3xl border border-[#2F2F2F] bg-[#171717] shadow-2xl overflow-hidden">
              <div class="px-6 py-5 border-b border-[#2F2F2F] flex items-start justify-between gap-4">
                <div>
                  <div class="text-[11px] uppercase tracking-[0.18em] text-[#737373] mb-2">渠道配置</div>
                  <h3 class="text-2xl font-semibold text-white">{{ selectedServiceMeta?.name }}</h3>
                  <p class="text-sm text-[#8E8E8E] mt-2 leading-6">{{ selectedServiceMeta?.description }}</p>
                </div>
                <button @click="closeModal" class="w-9 h-9 rounded-full border border-[#2F2F2F] text-[#A3A3A3] hover:text-white hover:border-[#404040] transition-colors">×</button>
              </div>

              <div class="p-6 grid lg:grid-cols-[1.15fr_0.85fr] gap-6 max-h-[80vh] overflow-auto">
                <div class="space-y-4">
                  <div v-if="selectedServiceMeta?.requiresApiKey">
                    <label class="block text-xs text-[#A3A3A3] mb-2 uppercase tracking-[0.18em]">API Key</label>
                    <input v-model="apiKey" type="password" class="input-field bg-[#191919] font-mono" :placeholder="selectedServiceMeta?.apiKeyFormat || '输入 API Key'" />
                  </div>

                  <div v-if="selectedServiceMeta?.requiresBaseUrl">
                    <div class="flex items-center justify-between gap-3 mb-2">
                      <label class="block text-xs text-[#A3A3A3] uppercase tracking-[0.18em]">Base URL</label>
                      <div class="flex items-center gap-3">
                        <button type="button" @click="copyText(selectedServiceMeta?.defaultBaseUrl)" class="text-[11px] text-[#8AB4FF] hover:text-[#B8D1FF] transition-colors">复制默认值</button>
                        <button type="button" @click="resetBaseUrlToDefault" class="text-[11px] text-[#60A5FA] hover:text-[#93C5FD] transition-colors">恢复默认</button>
                      </div>
                    </div>
                    <input v-model="baseUrl" type="text" class="input-field bg-[#191919]" :placeholder="selectedServiceMeta?.defaultBaseUrl || 'https://.../v1'" />
                  </div>

                  <div v-if="selectedServiceMeta?.requiresModel">
                    <div class="flex items-center justify-between gap-3 mb-2">
                      <label class="block text-xs text-[#A3A3A3] uppercase tracking-[0.18em]">模型名称</label>
                      <div class="flex items-center gap-3">
                        <button type="button" @click="copyText(selectedServiceMeta?.defaultModel)" class="text-[11px] text-[#8AB4FF] hover:text-[#B8D1FF] transition-colors">复制默认值</button>
                        <button type="button" @click="resetModelToDefault" class="text-[11px] text-[#60A5FA] hover:text-[#93C5FD] transition-colors">恢复默认</button>
                      </div>
                    </div>
                    <input v-model="model" type="text" class="input-field bg-[#191919]" :placeholder="selectedServiceMeta?.defaultModel || '输入模型名'" />
                  </div>

                  <div class="rounded-2xl border border-[#2F2F2F] bg-black/20 p-4 text-sm text-[#BDBDBD] leading-6">
                    {{ selectedServiceMeta?.requiresApiKey ? '建议先填官方默认地址与模型，再执行严格检测。检测会真实请求目标渠道，能区分鉴权失败、模型错误和端点异常。' : 'Cloudflare AI 可直接使用，但仍建议检测一次，确认运行环境可正常调用。' }}
                  </div>
                </div>

                <div class="space-y-4">
                  <div class="rounded-2xl border border-[#2F2F2F] bg-[#1C1C1C] p-4 space-y-4">
                    <div class="flex items-center justify-between gap-3">
                      <span class="text-xs text-[#737373] uppercase tracking-[0.18em]">当前状态</span>
                      <span :class="['px-3 py-1 rounded-full text-xs border', selectedValidationTone]">{{ selectedValidationLabel }}</span>
                    </div>
                    <div class="space-y-2 text-sm">
                      <div class="flex justify-between gap-4">
                        <span class="text-[#737373]">最近检测</span>
                        <span class="text-[#ECECEC] text-right">{{ formatDate(activeConfig?.last_checked_at) }}</span>
                      </div>
                      <div class="flex justify-between gap-4">
                        <span class="text-[#737373]">已保存 Base URL</span>
                        <span class="text-[#ECECEC] text-right break-all">{{ activeConfig?.base_url || selectedServiceMeta?.defaultBaseUrl || '—' }}</span>
                      </div>
                      <div class="flex justify-between gap-4">
                        <span class="text-[#737373]">已保存模型</span>
                        <span class="text-[#ECECEC] text-right break-all">{{ activeConfig?.model || selectedServiceMeta?.defaultModel || '—' }}</span>
                      </div>
                    </div>
                  </div>

                  <div class="rounded-2xl border border-[#2F2F2F] bg-[#161616] p-4">
                    <div class="text-xs text-[#737373] uppercase tracking-[0.18em] mb-4">状态时间线</div>
                    <div class="space-y-4">
                      <div v-for="item in statusTimeline" :key="item.title" class="flex gap-3">
                        <div class="flex flex-col items-center">
                          <span class="w-2.5 h-2.5 rounded-full mt-1" :class="item.tone"></span>
                          <span class="w-px flex-1 bg-[#2F2F2F] mt-2"></span>
                        </div>
                        <div class="pb-1">
                          <div class="text-sm text-white">{{ item.title }}</div>
                          <div class="text-xs text-[#9B9B9B] mt-1 leading-6">{{ item.value }}</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div class="rounded-2xl border border-[#2F2F2F] bg-black/20 p-4 min-h-[180px]">
                    <div class="text-xs text-[#737373] uppercase tracking-[0.18em] mb-3">检测反馈</div>
                    <p class="text-sm text-[#D5D5D5] leading-7">{{ testStatus !== 'idle' ? testMessage : activeConfig?.last_check_message || '保存后会标记为待检测。检测通过后，创作页和生成接口才会把该渠道视为可用。' }}</p>
                  </div>
                </div>
              </div>

              <div class="px-6 py-5 border-t border-[#2F2F2F] flex flex-wrap gap-3 justify-end bg-[#151515]">
                <button @click="closeModal" class="btn-ghost">取消</button>
                <button
                  @click="testConnection"
                  :disabled="testing || (selectedServiceMeta?.requiresApiKey && !apiKey) || (selectedServiceMeta?.requiresBaseUrl && !baseUrl) || (selectedServiceMeta?.requiresModel && !model)"
                  class="btn-secondary flex items-center gap-2"
                >
                  <span v-if="testing" class="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></span>
                  <span>{{ testing ? '检测中...' : '严格检测渠道' }}</span>
                </button>
                <button
                  @click="saveConfig"
                  :disabled="saving || (selectedServiceMeta?.requiresApiKey && !apiKey && !activeConfig) || (selectedServiceMeta?.requiresBaseUrl && !baseUrl) || (selectedServiceMeta?.requiresModel && !model)"
                  class="btn-primary flex items-center gap-2"
                >
                  <span v-if="saving" class="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></span>
                  <span>{{ saving ? '保存中...' : '保存并设为当前渠道' }}</span>
                </button>
              </div>
            </div>
          </div>
        </Teleport>
      </template>
    </div>
  </div>
</template>
