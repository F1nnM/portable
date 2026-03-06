import type { RouteRecordRaw } from "vue-router";
import { createRouter, createWebHistory } from "vue-router";
import ChatView from "./views/ChatView.vue";
import FilesView from "./views/FilesView.vue";
import GitView from "./views/GitView.vue";
import PreviewView from "./views/PreviewView.vue";

export const routes: RouteRecordRaw[] = [
  { path: "/", redirect: "/chat" },
  { path: "/chat", name: "chat", component: ChatView },
  { path: "/files", name: "files", component: FilesView },
  { path: "/git", name: "git", component: GitView },
  { path: "/preview", name: "preview", component: PreviewView },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
});
