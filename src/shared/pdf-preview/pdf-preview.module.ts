import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { PdfPreviewService } from './pdf-preview.service';

@Module({
  imports: [HttpModule],
  providers: [PdfPreviewService],
  exports: [PdfPreviewService],
})
export class PdfPreviewModule {}
