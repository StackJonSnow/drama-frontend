<script setup lang="ts">
import { RouterLink } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const authStore = useAuthStore();
</script>

<template>
  <div class="min-h-screen tech-bg grid-bg">
    <!-- 导航栏 -->
    <nav class="border-b border-dark-700/50 backdrop-blur-lg bg-dark-900/50">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between h-16 items-center">
          <div class="flex items-center">
            <RouterLink to="/" class="flex items-center space-x-2">
              <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center">
                <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>
              <span class="text-xl font-bold gradient-text">AI剧本生成器</span>
            </RouterLink>
          </div>
          
          <div class="flex items-center space-x-4">
            <template v-if="authStore.isAuthenticated">
              <RouterLink 
                to="/generate" 
                class="btn-primary text-sm"
              >
                开始创作
              </RouterLink>
              <RouterLink 
                to="/history" 
                class="text-gray-400 hover:text-white transition-colors"
              >
                历史记录
              </RouterLink>
              <RouterLink 
                to="/settings" 
                class="text-gray-400 hover:text-white transition-colors"
              >
                设置
              </RouterLink>
            </template>
            <template v-else>
              <RouterLink 
                to="/login" 
                class="text-gray-400 hover:text-white transition-colors"
              >
                登录
              </RouterLink>
              <RouterLink 
                to="/register" 
                class="btn-primary text-sm"
              >
                注册
              </RouterLink>
            </template>
          </div>
        </div>
      </div>
    </nav>

    <!-- 主要内容 -->
    <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <!-- Hero部分 -->
      <div class="text-center mb-16">
        <h1 class="text-5xl md:text-6xl font-bold mb-6">
          <span class="gradient-text">AI驱动</span>
          <br>
          <span class="text-white">剧本创作新时代</span>
        </h1>
        <p class="text-xl text-gray-400 max-w-3xl mx-auto mb-8">
          利用先进的人工智能技术，快速生成专业级剧本。
          支持电影、电视剧、短视频、广告等多种类型，
          让创意无限延伸。
        </p>
        <div class="flex flex-col sm:flex-row gap-4 justify-center">
          <RouterLink 
            v-if="authStore.isAuthenticated"
            to="/generate" 
            class="btn-primary text-lg px-8 py-4"
          >
            立即开始创作
          </RouterLink>
          <RouterLink 
            v-else
            to="/register" 
            class="btn-primary text-lg px-8 py-4"
          >
            免费注册体验
          </RouterLink>
          <RouterLink 
            to="/generate" 
            class="btn-secondary text-lg px-8 py-4"
          >
            了解更多
          </RouterLink>
        </div>
      </div>

      <!-- 特性展示 -->
      <div class="grid md:grid-cols-3 gap-8 mb-16">
        <div class="card group">
          <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h3 class="text-xl font-semibold text-white mb-2">极速生成</h3>
          <p class="text-gray-400">
            基于Cloudflare边缘网络，毫秒级响应，
            让您的创意瞬间变为现实。
          </p>
        </div>

        <div class="card group">
          <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <h3 class="text-xl font-semibold text-white mb-2">多模型支持</h3>
          <p class="text-gray-400">
            支持Cloudflare AI、OpenAI、Claude等多种AI模型，
            满足不同创作需求。
          </p>
        </div>

        <div class="card group">
          <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h3 class="text-xl font-semibold text-white mb-2">安全可靠</h3>
          <p class="text-gray-400">
            您的创作内容和个人数据得到最高级别的保护，
            隐私安全有保障。
          </p>
        </div>
      </div>

      <!-- 支持类型 -->
      <div class="text-center mb-16">
        <h2 class="text-3xl font-bold text-white mb-8">支持多种剧本类型</h2>
        <div class="flex flex-wrap justify-center gap-4">
          <div class="px-6 py-3 bg-dark-800/50 border border-dark-600 rounded-full text-gray-300 hover:border-primary-500 hover:text-white transition-all">
            电影剧本
          </div>
          <div class="px-6 py-3 bg-dark-800/50 border border-dark-600 rounded-full text-gray-300 hover:border-primary-500 hover:text-white transition-all">
            电视剧本
          </div>
          <div class="px-6 py-3 bg-dark-800/50 border border-dark-600 rounded-full text-gray-300 hover:border-primary-500 hover:text-white transition-all">
            短视频脚本
          </div>
          <div class="px-6 py-3 bg-dark-800/50 border border-dark-600 rounded-full text-gray-300 hover:border-primary-500 hover:text-white transition-all">
            广告脚本
          </div>
          <div class="px-6 py-3 bg-dark-800/50 border border-dark-600 rounded-full text-gray-300 hover:border-primary-500 hover:text-white transition-all">
            小说大纲
          </div>
        </div>
      </div>

      <!-- CTA -->
      <div class="text-center">
        <div class="card max-w-2xl mx-auto">
          <h2 class="text-2xl font-bold text-white mb-4">准备好开始创作了吗？</h2>
          <p class="text-gray-400 mb-6">
            加入我们，体验AI驱动的剧本创作，释放您的创意潜能。
          </p>
          <RouterLink 
            v-if="!authStore.isAuthenticated"
            to="/register" 
            class="btn-primary"
          >
            立即注册
          </RouterLink>
          <RouterLink 
            v-else
            to="/generate" 
            class="btn-primary"
          >
            开始创作
          </RouterLink>
        </div>
      </div>
    </main>

    <!-- 页脚 -->
    <footer class="border-t border-dark-700/50 mt-16">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div class="text-center text-gray-500">
          <p>&copy; 2026 AI剧本生成器. 基于Cloudflare Workers构建.</p>
        </div>
      </div>
    </footer>
  </div>
</template>