<script setup lang="ts">
import { ref } from 'vue';
import { useRouter, RouterLink } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useToast } from '@/composables/useToast';

const router = useRouter();
const authStore = useAuthStore();
const toast = useToast();

const name = ref('');
const email = ref('');
const password = ref('');
const confirmPassword = ref('');
const showPassword = ref(false);
const agreeTerms = ref(false);

async function handleRegister() {
  if (password.value !== confirmPassword.value) {
    toast.error('两次输入的密码不一致');
    return;
  }
  
  if (!agreeTerms.value) {
    toast.error('请同意服务条款');
    return;
  }
  
  try {
    await authStore.register({
      name: name.value,
      email: email.value,
      password: password.value,
    });
    
    toast.success('注册成功');
    router.push('/');
  } catch (error: any) {
    toast.error(error.message || '注册失败');
  }
}
</script>

<template>
  <div class="min-h-screen tech-bg grid-bg flex items-center justify-center p-4">
    <div class="w-full max-w-md">
      <!-- Logo -->
      <div class="text-center mb-8">
        <RouterLink to="/" class="inline-flex items-center space-x-2">
          <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center">
            <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
          <span class="text-2xl font-bold gradient-text">AI剧本生成器</span>
        </RouterLink>
      </div>

      <!-- 注册卡片 -->
      <div class="card">
        <h2 class="text-2xl font-bold text-white text-center mb-6">创建账号</h2>
        
        <!-- 错误提示 -->
        <div 
          v-if="authStore.error" 
          class="mb-4 p-4 bg-red-500/10 border border-red-500/50 rounded-lg text-red-400 text-sm"
        >
          {{ authStore.error }}
        </div>

        <form @submit.prevent="handleRegister" class="space-y-4">
          <div>
            <label for="name" class="block text-sm font-medium text-gray-400 mb-2">
              用户名
            </label>
            <input
              id="name"
              v-model="name"
              type="text"
              required
              class="input-field"
              placeholder="您的名字"
            />
          </div>

          <div>
            <label for="email" class="block text-sm font-medium text-gray-400 mb-2">
              邮箱地址
            </label>
            <input
              id="email"
              v-model="email"
              type="email"
              required
              class="input-field"
              placeholder="your@email.com"
            />
          </div>

          <div>
            <label for="password" class="block text-sm font-medium text-gray-400 mb-2">
              密码
            </label>
            <div class="relative">
              <input
                id="password"
                v-model="password"
                :type="showPassword ? 'text' : 'password'"
                required
                minlength="6"
                class="input-field pr-10"
                placeholder="••••••••"
              />
              <button
                type="button"
                @click="showPassword = !showPassword"
                class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
              >
                <svg v-if="!showPassword" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                <svg v-else class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                </svg>
              </button>
            </div>
          </div>

          <div>
            <label for="confirmPassword" class="block text-sm font-medium text-gray-400 mb-2">
              确认密码
            </label>
            <input
              id="confirmPassword"
              v-model="confirmPassword"
              :type="showPassword ? 'text' : 'password'"
              required
              minlength="6"
              class="input-field"
              placeholder="••••••••"
            />
          </div>

          <div class="flex items-start">
            <input
              id="agreeTerms"
              v-model="agreeTerms"
              type="checkbox"
              required
              class="mt-1 h-4 w-4 text-primary-500 bg-dark-800 border-dark-600 rounded focus:ring-primary-500"
            />
            <label for="agreeTerms" class="ml-2 text-sm text-gray-400">
              我同意
              <a href="#" class="text-primary-400 hover:text-primary-300">服务条款</a>
              和
              <a href="#" class="text-primary-400 hover:text-primary-300">隐私政策</a>
            </label>
          </div>

          <button
            type="submit"
            :disabled="authStore.loading"
            class="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span v-if="authStore.loading" class="flex items-center justify-center">
              <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              注册中...
            </span>
            <span v-else>注册</span>
          </button>
        </form>

        <div class="mt-6 text-center">
          <p class="text-gray-400">
            已有账号？
            <RouterLink to="/login" class="text-primary-400 hover:text-primary-300 font-medium">
              立即登录
            </RouterLink>
          </p>
        </div>
      </div>

      <!-- 返回首页 -->
      <div class="text-center mt-6">
        <RouterLink to="/" class="text-gray-500 hover:text-gray-400 text-sm">
          ← 返回首页
        </RouterLink>
      </div>
    </div>
  </div>
</template>