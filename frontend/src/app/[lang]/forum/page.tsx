import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { CategoryCard, CategoryCardSkeleton } from "@/components/forum/CategoryCard";
import { localeAlternates } from "@/i18n/config";
import { getLocale, getMessages } from "@/i18n/server";
import { getForumCategories, type ForumCategory } from "@/lib/api/forum";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const { forum } = await getMessages();
  return { title: forum.metaTitle, description: forum.metaDescription, alternates: localeAlternates(locale, "/forum") };
}

export default async function ForumPage() {
  const { forum } = await getMessages();

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-10 px-4 py-16 sm:px-6 sm:py-20">
      <header className="flex flex-col gap-4">
        <h1 className="font-display text-4xl leading-tight font-bold tracking-tight sm:text-5xl">{forum.title}</h1>
        <p className="text-lg leading-relaxed text-muted">{forum.intro}</p>
      </header>
      <Suspense fallback={<CategoryCardSkeleton label={forum.loading} />}>
        <Categories />
      </Suspense>
    </div>
  );
}

async function Categories() {
  await connection();
  const locale = await getLocale();
  const { forum } = await getMessages();

  let categories: ForumCategory[];
  try {
    categories = await getForumCategories(locale);
  } catch (error) {
    console.error("Forum unavailable", error);
    return <p className="text-muted">{forum.unavailable}</p>;
  }

  return (
    <ul className="flex flex-col gap-4">
      {categories.map((category) => (
        <li key={category.key}>
          <CategoryCard locale={locale} category={category} copy={forum} />
        </li>
      ))}
    </ul>
  );
}
