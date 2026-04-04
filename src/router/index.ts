import { createRouter, createWebHistory } from 'vue-router';
import type { RouteRecordRaw } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'Home',
    component: () => import('@/views/HomeView.vue'),
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/LoginView.vue'),
    meta: { guest: true },
  },
  {
    path: '/register',
    name: 'Register',
    component: () => import('@/views/RegisterView.vue'),
    meta: { guest: true },
  },
  {
    path: '/generate',
    name: 'Generate',
    component: () => import('@/views/GenerateView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/history',
    name: 'History',
    component: () => import('@/views/HistoryView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/script/:id',
    name: 'ScriptDetail',
    component: () => import('@/views/ScriptDetailView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/pipeline/:id',
    name: 'PipelineDetail',
    component: () => import('@/views/PipelineDetailView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/pipeline/:id/episode/:ep',
    name: 'EpisodeDetail',
    component: () => import('@/views/EpisodeDetailView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/settings',
    name: 'Settings',
    component: () => import('@/views/SettingsView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/studio/workflows',
    name: 'WorkflowStudio',
    component: () => import('@/views/WorkflowStudioView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/studio/prompts',
    name: 'PromptStudio',
    component: () => import('@/views/PromptStudioView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/pipeline/:id/editor',
    name: 'ScriptWorkbench',
    component: () => import('@/views/ScriptWorkbenchView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: () => import('@/views/NotFoundView.vue'),
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

// 导航守卫
router.beforeEach((to, from, next) => {
  const authStore = useAuthStore();
  
  // 需要认证的路由
  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    next({ name: 'Login', query: { redirect: to.fullPath } });
    return;
  }
  
  // 访客路由（已登录用户不能访问）
  if (to.meta.guest && authStore.isAuthenticated) {
    next({ name: 'Home' });
    return;
  }
  
  next();
});

export default router;
