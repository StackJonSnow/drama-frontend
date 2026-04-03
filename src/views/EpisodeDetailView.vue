<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRoute, useRouter, RouterLink } from 'vue-router';
import { usePipelineStore } from '@/stores/pipeline';
import { useToast } from '@/composables/useToast';

const route = useRoute();
const router = useRouter();
const pipelineStore = usePipelineStore();
const toast = useToast();

const taskId = route.params.id as string;
const episodeNumber = parseInt(route.params.ep as string);

const episode = ref<any>(null);
const loading = ref(true);

onMounted(async () => {
  try {
    episode.value = await pipelineStore.fetchEpisode(taskId, episodeNumber);
  } catch (error: any) {
    toast.error(error.message || '获取剧集失败');
    router.push(`/pipeline/${taskId}`);
  } finally {
    loading.value = false;
  }
});

// 格式化剧本内容为HTML (简易Markdown渲染)
function formatContent(content: string): string {
  if (!content) return '';
  return content
    // 标题
    .replace(/^# (.+)$/gm, '<h1 class="text-2xl font-bold text-white mt-6 mb-3">$1</h1>')
    .replace(/^## (.+)$/gm, '<h2 class="text-xl font-semibold text-white mt-6 mb-2">$1</h2>')
    // 引用
    .replace(/^> (.+)$/gm, '<blockquote class="border-l-4 border-sky-500/50 pl-4 text-gray-400 italic my-2">$1</blockquote>')
    // 分隔线
    .replace(/^---$/gm, '<hr class="border-gray-600 my-6" />')
    // 场景标记 (INT./EXT.)
    .replace(/^(INT\.|EXT\.)\s*(.+)$/gm, '<div class="text-sky-400 font-semibold mt-4 mb-2">$1 $2</div>')
    // 角色名 (全大写加粗)
    .replace(/^([A-Z\u4e00-\u9fa5]{2,})\s*$/gm, '<div class="text-yellow-400 font-bold mt-3">$1</div>')
    // 对白
    .replace(/^\s{2,}(.+)$/gm, '<div class="text-gray-300 ml-8 my-1">$1</div>')
    // 动作提示 [...]
    .replace(/\[(.+?)\]/g, '<span class="text-gray-500 italic">[$1]</span>')
    // 斜体 *...*
    .replace(/\*(.+?)\*/g, '<em class="text-gray-400">$1</em>')
    // 换行
    .replace(/\n/g, '<br />');
}

function copyContent() {
  if (episode.value?.content) {
    navigator.clipboard.writeText(episode.value.content);
    toast.success('已复制到剪贴板');
  }
}

async function downloadSingle() {
  if (!episode.value?.content) return;
  const blob = new Blob([episode.value.content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `第${episodeNumber}集_${episode.value.title || '剧本'}.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  toast.success('已下载');
}
</script>

<template>
  <div class="min-h-screen tech-bg grid-bg">
    <!-- 导航栏 -->
    <nav class="border-b border-gray-700/50 backdrop-blur-lg bg-gray-900/50">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between h-16 items-center">
          <RouterLink to="/" class="flex items-center space-x-2">
            <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-sky-500 to-sky-600 flex items-center justify-center">
              <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>
            <span class="text-xl font-bold gradient-text">AI剧本生成器</span>
          </RouterLink>
        </div>
      </div>
    </nav>

    <main class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <!-- 返回 -->
      <RouterLink :to="`/pipeline/${taskId}`" class="inline-flex items-center text-gray-400 hover:text-white mb-6 transition-colors">
        <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
        返回剧本详情
      </RouterLink>

      <!-- 加载 -->
      <div v-if="loading" class="flex justify-center py-12">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-500"></div>
      </div>

      <!-- 剧集内容 -->
      <div v-else-if="episode" class="space-y-6">
        <!-- 标题和操作 -->
        <div class="flex items-start justify-between">
          <div>
            <h1 class="text-3xl font-bold text-white mb-2">第{{ episodeNumber }}集: {{ episode.title }}</h1>
            <p class="text-gray-400">{{ episode.summary }}</p>
            <div class="flex items-center gap-4 mt-2 text-sm text-gray-500">
              <span>字数: {{ episode.word_count }}</span>
              <span v-if="episode.act">
                {{
                  episode.act === 'first_act' ? '第一幕' :
                  episode.act === 'second_act' ? '第二幕' : '第三幕'
                }}
              </span>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <button @click="copyContent" class="btn-secondary text-sm">
              <svg class="w-4 h-4 mr-2 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
              复制
            </button>
            <button @click="downloadSingle" class="btn-secondary text-sm">
              <svg class="w-4 h-4 mr-2 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              下载
            </button>
          </div>
        </div>

        <!-- 剧本正文 -->
        <div class="card">
          <div class="prose prose-invert max-w-none leading-relaxed" v-html="formatContent(episode.content)"></div>
        </div>

        <!-- 上下集导航 -->
        <div class="flex justify-between">
          <RouterLink
            v-if="episodeNumber > 1"
            :to="`/pipeline/${taskId}/episode/${episodeNumber - 1}`"
            class="btn-secondary"
          >
            <svg class="w-4 h-4 mr-2 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" /></svg>
            上一集
          </RouterLink>
          <div v-else></div>
          <RouterLink
            :to="`/pipeline/${taskId}/episode/${episodeNumber + 1}`"
            class="btn-secondary"
          >
            下一集
            <svg class="w-4 h-4 ml-2 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
          </RouterLink>
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
@reference "tailwindcss";

.card {
  @apply p-6 bg-gray-900/50 backdrop-blur-sm border border-gray-700/50 rounded-xl;
}
.btn-primary {
  @apply px-6 py-2 bg-sky-500 text-white rounded-lg hover:bg-sky-600 transition-colors font-medium;
}
.btn-secondary {
  @apply px-4 py-2 bg-gray-700 border border-gray-600 text-gray-300 rounded-lg hover:bg-gray-600 transition-colors;
}
</style>
