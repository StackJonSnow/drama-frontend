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
              <span class="text-xl font-bold gradient-text">AI 编剧工作室</span>
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
        <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary-500/20 bg-primary-500/10 text-primary-300 text-xs mb-6">
          企业级剧本研发工作流 / AI Assisted Writer's Room
        </div>
        <h1 class="text-5xl md:text-6xl font-bold mb-6">
          <span class="gradient-text">从创意到定稿</span>
          <br>
          <span class="text-white">一体化网剧编剧工作台</span>
        </h1>
        <p class="text-xl text-gray-400 max-w-3xl mx-auto mb-8">
          将剧本生成、流程编排、提示词治理、版本比较与成稿编辑整合进同一个工作空间。
          面向网剧、短剧与连续剧开发团队，构建更稳定、更可控的 AI 创作生产线。
        </p>
        <div class="flex flex-col sm:flex-row gap-4 justify-center">
          <RouterLink 
            v-if="authStore.isAuthenticated"
            to="/generate" 
            class="btn-primary text-lg px-8 py-4"
          >
                创建新项目
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
            进入项目库
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
           <h3 class="text-xl font-semibold text-white mb-2">项目化创作</h3>
           <p class="text-gray-400">
             从 logline、角色设定到成稿编辑，以项目维度统一管理，避免创意、版本与执行链路分散。
           </p>
        </div>

        <div class="card group">
          <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
           <h3 class="text-xl font-semibold text-white mb-2">可控 AI 流程</h3>
           <p class="text-gray-400">
             支持工作流编排、提示词模板治理、多模型切换与节点级日志，让生成过程可观察、可复用、可审计。
           </p>
        </div>

        <div class="card group">
          <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
           <h3 class="text-xl font-semibold text-white mb-2">版本与编辑闭环</h3>
           <p class="text-gray-400">
             支持版本快照、差异对比、结构化编辑和草稿保存，让 AI 初稿真正进入团队可用的改稿流程。
           </p>
        </div>
      </div>

      <!-- 支持类型 -->
      <div class="text-center mb-16">
        <h2 class="text-3xl font-bold text-white mb-8">适合影视内容团队的核心能力</h2>
        <div class="flex flex-wrap justify-center gap-4">
          <div class="px-6 py-3 bg-dark-800/50 border border-dark-600 rounded-full text-gray-300 hover:border-primary-500 hover:text-white transition-all">
            网剧开发
          </div>
          <div class="px-6 py-3 bg-dark-800/50 border border-dark-600 rounded-full text-gray-300 hover:border-primary-500 hover:text-white transition-all">
            短剧策划
          </div>
          <div class="px-6 py-3 bg-dark-800/50 border border-dark-600 rounded-full text-gray-300 hover:border-primary-500 hover:text-white transition-all">
            流程编排
          </div>
          <div class="px-6 py-3 bg-dark-800/50 border border-dark-600 rounded-full text-gray-300 hover:border-primary-500 hover:text-white transition-all">
            提示词治理
          </div>
          <div class="px-6 py-3 bg-dark-800/50 border border-dark-600 rounded-full text-gray-300 hover:border-primary-500 hover:text-white transition-all">
            版本对比
          </div>
        </div>
      </div>

      <!-- CTA -->
      <div class="text-center">
        <div class="card max-w-2xl mx-auto">
          <h2 class="text-2xl font-bold text-white mb-4">准备好把 AI 接入你的编剧流程了吗？</h2>
          <p class="text-gray-400 mb-6">
            用一个统一工作台管理创意输入、生成过程、编辑改稿与版本沉淀。
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
            创建新项目
          </RouterLink>
        </div>
      </div>
    </main>

    <!-- 页脚 -->
    <footer class="border-t border-dark-700/50 mt-16">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div class="text-center text-gray-500">
          <p>&copy; 2026 AI 编剧工作室. 为网剧内容团队打造的 AI 协作生产台.</p>
        </div>
      </div>
    </footer>
  </div>
</template>
