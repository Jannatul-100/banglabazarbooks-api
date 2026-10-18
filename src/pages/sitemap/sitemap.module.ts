import { Module } from '@nestjs/common';
import { SitemapController } from './sitemap.controller';
import { SitemapService } from './sitemap.service';
import { ProductModule } from '../product/product.module';
import { BlogModule } from '../blog/blog/blog.module';
import { CategoryModule } from '../catalog/category/category.module';
import { AuthorModule } from '../catalog/author/author.module';

@Module({
  imports: [ProductModule, BlogModule, CategoryModule, AuthorModule],
  controllers: [SitemapController],
  providers: [SitemapService],
})
export class SitemapModule {}
