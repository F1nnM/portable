import type { Project } from "../../types/project";
import { mountSuspended } from "@nuxt/test-utils/runtime";
// @vitest-environment nuxt
import { describe, expect, it, vi } from "vitest";
import ProjectCard from "../../components/ProjectCard.vue";

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: "test-id-1",
    name: "My Test Project",
    slug: "my-test-project",
    scaffoldId: "nuxt-postgres",
    status: "stopped",
    repoUrl: "https://github.com/user/my-test-project",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("projectCard", () => {
  it("renders project name", async () => {
    const wrapper = await mountSuspended(ProjectCard, {
      props: { project: makeProject({ name: "Alpha Project" }) },
    });
    expect(wrapper.text()).toContain("Alpha Project");
  });

  it("renders status label for stopped project", async () => {
    const wrapper = await mountSuspended(ProjectCard, {
      props: { project: makeProject({ status: "stopped" }) },
    });
    expect(wrapper.text()).toContain("Stopped");
  });

  it("renders status label for running project", async () => {
    const wrapper = await mountSuspended(ProjectCard, {
      props: { project: makeProject({ status: "running" }) },
    });
    expect(wrapper.text()).toContain("Running");
  });

  it("shows correct status dot class for running project", async () => {
    const wrapper = await mountSuspended(ProjectCard, {
      props: { project: makeProject({ status: "running" }) },
    });
    const dot = wrapper.find(".status-dot");
    expect(dot.exists()).toBe(true);
    expect(dot.classes()).toContain("status-dot-pulse");
  });

  it("shows correct status dot class for stopped project (no animation)", async () => {
    const wrapper = await mountSuspended(ProjectCard, {
      props: { project: makeProject({ status: "stopped" }) },
    });
    const dot = wrapper.find(".status-dot");
    expect(dot.exists()).toBe(true);
    expect(dot.classes()).not.toContain("status-dot-pulse");
    expect(dot.classes()).not.toContain("status-dot-blink");
  });

  it("shows pulsing dot for transitional states", async () => {
    const wrapper = await mountSuspended(ProjectCard, {
      props: { project: makeProject({ status: "starting" }) },
    });
    const dot = wrapper.find(".status-dot");
    expect(dot.classes()).toContain("status-dot-blink");
  });

  it("shows error status dot class for error state", async () => {
    const wrapper = await mountSuspended(ProjectCard, {
      props: { project: makeProject({ status: "error" }) },
    });
    const indicator = wrapper.find(".status-indicator");
    expect(indicator.classes()).toContain("status-error");
    expect(wrapper.text()).toContain("Error");
  });

  it("opens menu on three-dot button click", async () => {
    const wrapper = await mountSuspended(ProjectCard, {
      props: { project: makeProject() },
    });
    expect(wrapper.find(".menu-dropdown").exists()).toBe(false);
    await wrapper.find(".btn-menu").trigger("click");
    expect(wrapper.find(".menu-dropdown").exists()).toBe(true);
  });

  it("menu contains Start option for stopped project", async () => {
    const wrapper = await mountSuspended(ProjectCard, {
      props: { project: makeProject({ status: "stopped" }) },
    });
    await wrapper.find(".btn-menu").trigger("click");
    const menuItems = wrapper.findAll(".menu-item");
    const texts = menuItems.map((item) => item.text());
    expect(texts).toContain("Start");
  });

  it("menu contains Stop option for running project", async () => {
    const wrapper = await mountSuspended(ProjectCard, {
      props: { project: makeProject({ status: "running" }) },
    });
    await wrapper.find(".btn-menu").trigger("click");
    const menuItems = wrapper.findAll(".menu-item");
    const texts = menuItems.map((item) => item.text());
    expect(texts).toContain("Stop");
  });

  it("menu contains Open GitHub Repo option when repoUrl is set", async () => {
    const wrapper = await mountSuspended(ProjectCard, {
      props: {
        project: makeProject({ repoUrl: "https://github.com/user/repo" }),
      },
    });
    await wrapper.find(".btn-menu").trigger("click");
    const menuItems = wrapper.findAll(".menu-item");
    const texts = menuItems.map((item) => item.text());
    expect(texts.some((t) => t.includes("GitHub"))).toBe(true);
  });

  it("menu contains Rename and Delete options", async () => {
    const wrapper = await mountSuspended(ProjectCard, {
      props: { project: makeProject() },
    });
    await wrapper.find(".btn-menu").trigger("click");
    const menuItems = wrapper.findAll(".menu-item");
    const texts = menuItems.map((item) => item.text());
    expect(texts).toContain("Rename");
    expect(texts).toContain("Delete");
  });

  it("emits starting event when Start menu item is clicked", async () => {
    // Mock $fetch so the Start API call doesn't fail
    vi.stubGlobal(
      "$fetch",
      vi.fn().mockResolvedValue({ ok: true }),
    );

    const wrapper = await mountSuspended(ProjectCard, {
      props: { project: makeProject({ status: "stopped" }) },
    });
    await wrapper.find(".btn-menu").trigger("click");
    const menuItems = wrapper.findAll(".menu-item");
    const startItem = menuItems.find((item) => item.text() === "Start");
    expect(startItem).toBeDefined();
    await startItem!.trigger("click");
    expect(wrapper.emitted("starting")).toBeTruthy();

    vi.unstubAllGlobals();
  });

  it("card is clickable and has a link to /projects/:slug", async () => {
    const wrapper = await mountSuspended(ProjectCard, {
      props: { project: makeProject({ slug: "my-proj" }) },
    });
    const link = wrapper.find(".card-link");
    expect(link.exists()).toBe(true);
    expect(link.attributes("href") || link.attributes("to")).toContain("/projects/my-proj");
  });
});
