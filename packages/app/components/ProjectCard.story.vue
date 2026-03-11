<script setup lang="ts">
import type { Project } from "~/types/project";
import ProjectCard from "./ProjectCard.vue";

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: "1",
    name: "My Project",
    slug: "my-project",
    scaffoldId: "nuxt-postgres",
    status: "stopped",
    repoUrl: "https://github.com/user/my-project",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}
</script>

<template>
  <Story title="Project / ProjectCard" group="project">
    <Variant title="Stopped">
      <div style="max-width: 480px; padding: 16px">
        <ProjectCard :project="makeProject({ status: 'stopped' })" />
      </div>
    </Variant>

    <Variant title="Running">
      <div style="max-width: 480px; padding: 16px">
        <ProjectCard :project="makeProject({ status: 'running' })" />
      </div>
    </Variant>

    <Variant title="Starting">
      <div style="max-width: 480px; padding: 16px">
        <ProjectCard :project="makeProject({ status: 'starting' })" />
      </div>
    </Variant>

    <Variant title="Creating">
      <div style="max-width: 480px; padding: 16px">
        <ProjectCard :project="makeProject({ status: 'creating' })" />
      </div>
    </Variant>

    <Variant title="Stopping">
      <div style="max-width: 480px; padding: 16px">
        <ProjectCard :project="makeProject({ status: 'stopping' })" />
      </div>
    </Variant>

    <Variant title="Error">
      <div style="max-width: 480px; padding: 16px">
        <ProjectCard :project="makeProject({ status: 'error' })" />
      </div>
    </Variant>

    <Variant title="No GitHub Repo (Scaffold)">
      <div style="max-width: 480px; padding: 16px">
        <ProjectCard
          :project="makeProject({ status: 'running', repoUrl: null, scaffoldId: 'nuxt-postgres' })"
        />
      </div>
    </Variant>

    <Variant title="Long Name">
      <div style="max-width: 480px; padding: 16px">
        <ProjectCard
          :project="
            makeProject({
              name: 'A Very Long Project Name That Should Truncate Properly When Displayed',
              slug: 'a-very-long-project-name',
              status: 'running',
            })
          "
        />
      </div>
    </Variant>
  </Story>
</template>
