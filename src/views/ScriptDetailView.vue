<script setup lang="ts">
import { onMounted } from 'vue';
import { useRoute, useRouter, RouterLink } from 'vue-router';
import { useScriptStore } from '@/stores/script';
import { useToast } from '@/composables/useToast';

const route = useRoute();
const router = useRouter();
const scriptStore = useScriptStore();
const toast = useToast();

const scriptId = Number(route.params.id);

onMounted(async () => {
  try {
    await scriptStore.fetchScript(scriptId);
  } catch (error: any) {
    toast.error(error.message || '获取剧本详情失败');
    router.push('/history');
  }
});

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getScriptTypeLabel(type: string) {
  const types: Record<string, string> = {
    movie: '电影',
    tv: '电视剧',
    'short-video': '短视频',
    commercial: '广告',
    novel: '小说',
  };
  return types[type] || type;
}

function getLengthLabel(length: string) {
  const lengths: Record<string, string> = {
    short: '短篇 (5-10分钟)',
    medium: '中篇 (15-30分钟)',
    long: '长篇 (30分钟以上)',
  };
  return lengths[length] || length;
}

async function copyToClipboard() {
  if (scriptStore.currentScript) {
    try {
      await navigator.clipboard.writeText(scriptStore.currentScript.content);
      toast.success('已复制到剪贴板');
    } catch {
      toast.error('复制失败，请手动复制');
    }
  }
}

async function deleteScript() {
  if (confirm('确定要删除这个剧本吗？此操作不可恢复。')) {
    try {
      await scriptStore.deleteScript(scriptId);
      toast.success('剧本已删除');
      router.push('/history');
    } catch (error: any) {
      toast.error(error.message || '删除剧本失败');
    }
  }
}
</script>

<template>
  <div class="min-h-screen tech-bg grid-bg">
    <!-- 导航栏 -->
    <nav class="border-b border-dark-700/50 backdrop-blur-lg bg-dark-900/50">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between h-16 items-center">
          <RouterLink to="/" class="flex items-center space-x-2">
            <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center">
              <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>
            <span class="text-xl font-bold gradient-text">AI剧本生成器</span>
          </RouterLink>
          
          <div class="flex items-center space-x-4">
            <RouterLink to="/generate" class="btn-primary text-sm">
              开始创作
            </RouterLink>
            <RouterLink to="/history" class="text-gray-400 hover:text-white transition-colors">
              历史记录
            </RouterLink>
          </div>
        </div>
      </div>
    </nav>

    <!-- 主要内容 -->
    <main class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <!-- 返回按钮 -->
      <RouterLink 
        to="/history" 
        class="inline-flex items-center text-gray-400 hover:text-white mb-6 transition-colors"
      >
        <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        返回历史记录
      </RouterLink>

      <!-- 加载状态 -->
      <div v-if="scriptStore.loading" class="flex justify-center py-12">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>

      <!-- 剧本详情 -->
      <div v-else-if="scriptStore.currentScript" class="space-y-6">
        <!-- 标题和操作 -->
        <div class="flex items-start justify-between">
          <div>
            <h1 class="text-3xl font-bold text-white mb-2">
              {{ scriptStore.currentScript.title }}
            </h1>
            <div class="flex items-center gap-3">
              <span class="px-3 py-1 text-sm rounded-full bg-primary-500/10 text-primary-400">
                {{ getScriptTypeLabel(scriptStore.currentScript.script_type || 'movie') }}
              </span>
              <span class="text-gray-500 text-sm">
                {{ formatDate(scriptStore.currentScript.created_at) }}
              </span>
            </div>
          </div>
          
          <div class="flex items-center gap-2">
            <button 
              @click="copyToClipboard"
              class="btn-secondary text-sm"
            >
              <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              复制内容
            </button>
            <button 
              @click="deleteScript"
              class="p-2 text-gray-400 hover:text-red-400 transition-colors"
              title="删除剧本"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>

        <!-- 元数据卡片 -->
        <div class="grid md:grid-cols-3 gap-4">
          <div class="card">
            <div class="text-sm text-gray-500 mb-1">题材类型</div>
            <div class="text-white font-medium">{{ scriptStore.currentScript.genre || '未设置' }}</div>
          </div>
          <div class="card">
            <div class="text-sm text-gray-500 mb-1">剧本长度</div>
            <div class="text-white font-medium">{{ getLengthLabel(scriptStore.currentScript.length || 'short') }}</div>
          </div>
          <div class="card">
            <div class="text-sm text-gray-500 mb-1">AI服务</div>
            <div class="text-white font-medium">{{ scriptStore.currentScript.ai_service || 'Cloudflare AI' }}</div>
          </div>
        </div>

        <!-- 角色和场景 -->
        <div v-if="scriptStore.currentScript.characters?.length || scriptStore.currentScript.scene" class="grid md:grid-cols-2 gap-4">
          <div v-if="scriptStore.currentScript.characters?.length" class="card">
            <div class="text-sm text-gray-500 mb-2">角色</div>
            <div class="flex flex-wrap gap-2">
              <span 
                v-for="(character, index) in scriptStore.currentScript.characters" 
                :key="index"
                class="px-3 py-1 bg-dark-700 rounded-full text-gray-300 text-sm"
              >
                {{ character }}
              </span>
            </div>
          </div>
          <div v-if="scriptStore.currentScript.scene" class="card">
            <div class="text-sm text-gray-500 mb-2">场景设定</div>
            <div class="text-gray-300">{{ scriptStore.currentScript.scene }}</div>
          </div>
        </div>

        <!-- 剧本内容 -->
        <div class="card">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-xl font-semibold text-white">剧本内容</h2>
          </div>
          <div class="prose prose-invert max-w-none">
            <pre class="whitespace-pre-wrap text-gray-300 font-sans leading-relaxed">{{ scriptStore.currentScript.content }}</pre>
          </div>
        </div>
      </div>

      <!-- 未找到 -->
      <div v-else class="text-center py-12">
        <div class="w-24 h-24 mx-auto mb-4 rounded-full bg-dark-800 flex items-center justify-center">
          <svg class="w-12 h-12 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h3 class="text-xl font-semibold text-white mb-2">剧本未找到</h3>
        <p class="text-gray-400 mb-6">该剧本可能已被删除或不存在</p>
        <RouterLink to="/history" class="btn-primary">
          返回历史记录
        </RouterLink>
      </div>
    </main>
  </div>
</template>