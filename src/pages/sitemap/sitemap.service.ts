import { Injectable } from '@nestjs/common';
import { SitemapStream, streamToPromise } from 'sitemap';
import { ProductService } from '../product/product.service';
import { BlogService } from '../blog/blog/blog.service';
import { CategoryService } from '../catalog/category/category.service';
import { AuthorService } from '../catalog/author/author.service';

@Injectable()
export class SitemapService {
  constructor(
    private readonly productService: ProductService,
    private readonly blogService: BlogService,
    private readonly categoryService: CategoryService,
    private readonly authorService: AuthorService,
  ) {}

  async generateSitemapXml(): Promise<string> {
    // Strictly use https://www. canonical URL as per SEO requirements
    const hostname = 'https://www.banglabazarbooks.com';
    const smStream = new SitemapStream({ hostname });

    // 1. Core Indexable Static Pages — exact frontend routes
    smStream.write({ url: '/', changefreq: 'daily', priority: 1.0 });
    smStream.write({ url: '/product-list', changefreq: 'daily', priority: 0.9 });
    smStream.write({ url: '/blogs', changefreq: 'daily', priority: 0.8 });
    smStream.write({ url: '/activities', changefreq: 'daily', priority: 0.8 });
    smStream.write({ url: '/author-list', changefreq: 'weekly', priority: 0.8 });
    smStream.write({ url: '/category-list', changefreq: 'weekly', priority: 0.7 });
    smStream.write({ url: '/special-package', changefreq: 'weekly', priority: 0.7 });
    smStream.write({ url: '/offers', changefreq: 'daily', priority: 0.8 });
    smStream.write({ url: '/contact-us', changefreq: 'monthly', priority: 0.5 });
    smStream.write({ url: '/find-book-location', changefreq: 'monthly', priority: 0.4 });
    smStream.write({ url: '/all-video', changefreq: 'weekly', priority: 0.5 });
    smStream.write({ url: '/pages/terms-and-conditions', changefreq: 'monthly', priority: 0.3 });
    smStream.write({ url: '/pages/privacy-policy', changefreq: 'monthly', priority: 0.3 });
    smStream.write({ url: '/pages/return-and-refund-policy', changefreq: 'monthly', priority: 0.3 });
    smStream.write({ url: '/pages/manuscript-terms', changefreq: 'monthly', priority: 0.3 });

    // 2. Published Products — correct frontend route: /product-details/:slug
    const products = await this.productService.findAllPublished();
    products.forEach((product) => {
      if (product.slug) {
        smStream.write({
          url: `/product-details/${product.slug}`,
          changefreq: 'weekly',
          priority: 0.9,
          lastmod: product.updatedAt ? product.updatedAt.toISOString() : undefined,
        });
      }
    });

    // 3. Published Blogs — correct frontend route: /blog/:slug
    const blogs = await this.blogService.findAllPublished();
    blogs.forEach((blog) => {
      if (blog.slug) {
        smStream.write({
         url: `/blogs/${blog.slug}`,
          changefreq: 'weekly',
          priority: 0.8,
          lastmod: blog.updatedAt ? blog.updatedAt.toISOString() : undefined,
        });
      }
    });

    // 4. Published Categories — correct frontend route: /product-list?categories=:slug
    const categories = await this.categoryService.findAllPublished();
    categories.forEach((category) => {
      if (category.slug) {
        smStream.write({
          url: `/product-list?categories=${category.slug}`,
          changefreq: 'weekly',
          priority: 0.7,
          lastmod: category['updatedAt'] ? new Date(category['updatedAt']).toISOString() : undefined,
        });
      }
    });

    // 5. Published Authors — correct frontend route: /author/:slug
    const authors = await this.authorService.findAllPublished();
    authors.forEach((author) => {
      if (author.slug) {
        smStream.write({
          url: `/author/${author.slug}`,
          changefreq: 'weekly',
          priority: 0.7,
          lastmod: author.updatedAt ? new Date(author.updatedAt).toISOString() : undefined,
        });
      }
    });

    smStream.end();
    const xml = await streamToPromise(smStream);
    return xml.toString();
  }
}
