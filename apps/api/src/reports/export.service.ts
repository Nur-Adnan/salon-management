import { BadRequestException, Injectable } from '@nestjs/common';
import { convertToCsv } from '@salon/shared';

export interface ExportResult {
  filename: string;
  mimeType: string;
  content: string;
}

@Injectable()
export class ExportService {
  exportReport(
    reportType: 'sales' | 'staff' | 'inventory',
    data: any,
    format: 'csv' | 'excel' | 'pdf' = 'csv',
  ): ExportResult {
    switch (reportType) {
      case 'sales':
        return this.exportSales(data, format);
      case 'staff':
        return this.exportStaff(data, format);
      case 'inventory':
        return this.exportInventory(data, format);
      default:
        throw new BadRequestException(`Unsupported report type: ${reportType}`);
    }
  }

  private exportSales(data: any, format: string): ExportResult {
    const buckets = data.buckets ?? [];
    const headers = [
      'Date / Bucket',
      'Gross Sales (BDT Poisha)',
      'Discounts (BDT Poisha)',
      'Tax (BDT Poisha)',
      'Tips (BDT Poisha)',
      'Net Revenue (BDT Poisha)',
      'Transaction Count',
    ];

    const rows = buckets.map((b: any) => [
      b.bucket ?? b._id,
      b.gross ?? 0,
      b.discounts ?? 0,
      b.tax ?? 0,
      b.tips ?? 0,
      b.total ?? b.net ?? 0,
      b.count ?? 0,
    ]);

    if (format === 'csv') {
      const csv = convertToCsv(headers, rows);
      return {
        filename: `sales-report-${Date.now()}.csv`,
        mimeType: 'text/csv',
        content: csv,
      };
    }

    if (format === 'excel') {
      const csv = convertToCsv(headers, rows);
      return {
        filename: `sales-report-${Date.now()}.xls`,
        mimeType: 'application/vnd.ms-excel',
        content: csv,
      };
    }

    // PDF / Text Document Summary
    const lines = [
      `SALES REPORT SUMMARY`,
      `====================`,
      `Generated: ${new Date().toISOString()}`,
      `Total Buckets: ${buckets.length}`,
      ``,
      headers.join(' | '),
      `--------------------------------------------------------------------------------`,
      ...rows.map((r: any[]) => r.join(' | ')),
    ];
    return {
      filename: `sales-report-${Date.now()}.txt`,
      mimeType: 'application/pdf',
      content: lines.join('\n'),
    };
  }

  private exportStaff(data: any, format: string): ExportResult {
    const staffList = Array.isArray(data) ? data : data.staff ?? [];
    const headers = [
      'Staff ID',
      'Attributed Net (BDT Poisha)',
      'Commission (BDT Poisha)',
      'Tips (BDT Poisha)',
      'Hours Worked',
      'Sales Count',
    ];

    const rows = staffList.map((s: any) => [
      s.staffId,
      s.netAttributed ?? 0,
      s.commission ?? 0,
      s.tips ?? 0,
      s.hoursWorked ?? 0,
      s.saleCount ?? 0,
    ]);

    const csv = convertToCsv(headers, rows);
    return {
      filename: `staff-performance-${Date.now()}.${format === 'excel' ? 'xls' : 'csv'}`,
      mimeType: format === 'excel' ? 'application/vnd.ms-excel' : 'text/csv',
      content: csv,
    };
  }

  private exportInventory(data: any, format: string): ExportResult {
    const items = data.items ?? [];
    const headers = ['Product ID', 'Name', 'Qty On Hand', 'Reorder Point', 'Unit Cost (Poisha)', 'Total Value (Poisha)'];
    const rows = items.map((i: any) => [
      i.productId,
      i.name,
      i.qtyOnHand ?? 0,
      i.reorderPoint ?? 0,
      i.unitCost ?? 0,
      i.value ?? 0,
    ]);

    const csv = convertToCsv(headers, rows);
    return {
      filename: `inventory-value-${Date.now()}.${format === 'excel' ? 'xls' : 'csv'}`,
      mimeType: format === 'excel' ? 'application/vnd.ms-excel' : 'text/csv',
      content: csv,
    };
  }
}
