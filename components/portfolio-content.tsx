import { HomeSectionLink } from '@/components/home-section-link';
import Link from 'next/link';
import { projects } from '@/lib/content';
import { ProjectHoop } from './project-hoop';

export function ProjectGrid({ featured = false }: { featured?: boolean }) {
  const Heading = featured ? 'h3' : 'h2';
  return (
    <div className="project-grid">
      {(featured ? projects.slice(0, 3) : projects).map((project) => (
        <article className="project-card" key={project.id}>
          <div className="project-cover-stage">
            <div
              className={`project-cover tone-${project.tone}`}
              data-basketball-collider
            >
              <span aria-hidden="true">{project.mark}</span>
            </div>
            <ProjectHoop id={project.id} title={project.title} />
          </div>
          <div className="project-caption">
            <Heading>{project.title}</Heading>
            <p>
              {project.category}
              {!featured && <span> · {project.year}</span>}
            </p>
          </div>
        </article>
      ))}
    </div>
  );
}

export type PostSummary = {
  id: string;
  title: string | null;
  slug: string | null;
  tags: string[];
  firstPublishedAt: Date | null;
};
export function PostList({
  featured = false,
  posts,
}: {
  featured?: boolean;
  posts: PostSummary[];
}) {
  const Heading = featured ? 'h3' : 'h2';
  if (!posts.length)
    return (
      <div className="blog-empty">
        <span className="blog-eyebrow">A QUIET BEGINNING</span>
        <p>这里还没有文章。</p>
        <span>新的记录，会慢慢出现在这里。</span>
      </div>
    );
  return (
    <div className="writing-list">
      {posts.map((post) => {
        const date = post.firstPublishedAt!.toISOString().slice(0, 10);
        return (
          <article className="writing-row" key={post.id}>
            <time dateTime={date}>{date.replaceAll('-', '.')}</time>
            <div>
              <Heading>
                <Link href={`/blog/${post.slug}`}>{post.title}</Link>
              </Heading>
              <div className="post-tags">
                {post.tags.map((tag) => (
                  <Link href={`/blog?tag=${encodeURIComponent(tag)}`} key={tag}>
                    {tag}
                  </Link>
                ))}
              </div>
            </div>
            <Link
              className="writing-arrow"
              href={`/blog/${post.slug}`}
              aria-label={`阅读：${post.title}`}
            >
              ↗
            </Link>
          </article>
        );
      })}
    </div>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer container">
      <div className="footer-legal">
        <small>JIUHENG © 2026</small>
        <a
          className="icp-link"
          href="https://beian.miit.gov.cn/"
          target="_blank"
          rel="noreferrer"
        >
          皖ICP备2026031835号-1
        </a>
      </div>
      <nav aria-label="页脚导航">
        <HomeSectionLink section="writing">博客</HomeSectionLink>
        <HomeSectionLink section="featured">作品</HomeSectionLink>
        <Link className="admin-entry" href="/admin">
          管理
        </Link>
      </nav>
    </footer>
  );
}
