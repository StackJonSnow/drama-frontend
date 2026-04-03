<script setup lang="ts">
import { RouterLink } from 'vue-router';
</script>

<template>
  <div class="min-h-screen tech-bg grid-bg flex items-center justify-center p-4">
    <div class="text-center">
      <h1 class="text-9xl font-bold gradient-text mb-4">404</h1>
      <h2 class="text-2xl font-semibold text-white mb-4">页面未找到</h2>
      <p class="text-gray-400 mb-8 max-w-md mx-auto">
        您访问的页面不存在或已被移除。请检查URL是否正确，或返回首页继续浏览。
      </p>
      <RouterLink to="/" class="btn-primary">
        返回首页
      </RouterLink>
    </div>
  </div>
</template>