// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// Published to GitHub Pages as a project site. To move to a custom domain,
// put the hostname in site/public/CNAME and set `site` to it with base '/'.
export default defineConfig({
  site: 'https://fedcal.github.io',
  base: '/foundry',
  trailingSlash: 'ignore',
  integrations: [
    starlight({
      title: 'Foundry',
      tagline: 'The senior-engineering stack for Claude Code',
      description:
        'Agents, skills, hooks, MCP, governed memory and deployment practice for Claude Code — packaged as an installable plugin marketplace.',
      logo: { src: './src/assets/mark.svg', replacesTitle: false },
      favicon: '/favicon.svg',
      social: [
        { icon: 'github', label: 'GitHub', href: 'https://github.com/fedcal/foundry' },
        { icon: 'external', label: 'federicocalo.dev', href: 'https://federicocalo.dev' },
      ],
      editLink: { baseUrl: 'https://github.com/fedcal/foundry/edit/main/site/' },
      lastUpdated: true,
      pagination: true,
      customCss: ['./src/styles/foundry.css'],
      components: { Footer: './src/components/Footer.astro' },
      defaultLocale: 'en',
      locales: {
        en: { label: 'English', lang: 'en' },
        it: { label: 'Italiano', lang: 'it' },
      },
      sidebar: [
        {
          label: 'Start here',
          translations: { it: 'Per iniziare' },
          items: [{ autogenerate: { directory: 'start' } }],
        },
        {
          label: 'Concepts',
          translations: { it: 'Concetti' },
          items: [{ autogenerate: { directory: 'concepts' } }],
        },
        {
          label: 'Plugins',
          translations: { it: 'Plugin' },
          items: [{ autogenerate: { directory: 'plugins' } }],
        },
        {
          label: 'Reference',
          translations: { it: 'Riferimento' },
          items: [{ autogenerate: { directory: 'reference' } }],
        },
        {
          label: 'Project',
          translations: { it: 'Progetto' },
          items: [{ autogenerate: { directory: 'project' } }],
        },
      ],
    }),
  ],
});
