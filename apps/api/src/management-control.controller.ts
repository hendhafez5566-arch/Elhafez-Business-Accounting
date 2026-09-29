import { BadRequestException, Controller, Get, Headers, Inject, Query, UnauthorizedException } from '@nestjs/common';
import { executionContext, type ExecutionContext } from '@elhafez/contracts';
import { PLATFORM_CORE_PERMISSIONS, PlatformCoreApplicationService } from '@elhafez/platform-core';
import type { AttentionSeverity, ManagementDomain, ManagementOverview, WorkCenterFilter } from './management-control.service.js';
import { ManagementControlService } from './management-control.service.js';

const DOMAINS: readonly ManagementDomain[] = ['CRM_SALES', 'SUPPLIERS_PROCUREMENT', 'HAJJ_UMRAH', 'FINANCE'];
const SEVERITIES: readonly AttentionSeverity[] = ['CRITICAL', 'HIGH', 'NORMAL'];
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** استعلام HTTP الخام قبل التحقق. لا يتضمن company/branch — فهما نطاق أمني يُستمد من ExecutionContext. */
export interface RawWorkCenterQuery { readonly domain?: string; readonly severity?: string; readonly status?: string; readonly category?: string; readonly from?: string; readonly to?: string; }

/** يحوّل الاستعلام الخام إلى WorkCenterFilter صالح أو يرمي BadRequestException (400). */
export function parseWorkCenterFilter(query: RawWorkCenterQuery): WorkCenterFilter {
  const filter: { -readonly [K in keyof WorkCenterFilter]: WorkCenterFilter[K] } = {};
  if (query.domain) {
    if (!DOMAINS.includes(query.domain as ManagementDomain)) throw new BadRequestException(`unsupported domain filter: ${query.domain}`);
    filter.domain = query.domain as ManagementDomain;
  }
  if (query.severity) {
    if (!SEVERITIES.includes(query.severity as AttentionSeverity)) throw new BadRequestException(`unsupported severity filter: ${query.severity}`);
    filter.severity = query.severity as AttentionSeverity;
  }
  const status = query.status?.trim(); if (status) filter.status = status;
  const category = query.category?.trim(); if (category) filter.category = category;
  const from = parseDate('from', query.from); if (from) filter.from = from;
  const to = parseDate('to', query.to); if (to) filter.to = to;
  if (filter.from && filter.to && filter.from > filter.to) throw new BadRequestException('from must not be after to');
  return filter;
}

/** تحقق تقويمي صارم: صيغة YYYY-MM-DD، ثم بناء تاريخ UTC والتأكد أن مكوناته تطابق المُدخل (يرفض 2026-02-31 و2026-04-31 و2026-13-01). */
function parseDate(field: 'from' | 'to', value: string | undefined): string | undefined {
  if (!value) return undefined;
  const match = ISO_DATE.exec(value);
  if (!match) throw new BadRequestException(`${field} must be an ISO date (YYYY-MM-DD)`);
  const year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) throw new BadRequestException(`${field} is not a valid calendar date: ${value}`);
  return value;
}

@Controller('management-control')
export class ManagementControlController {
  constructor(
    @Inject(ManagementControlService) private readonly service: ManagementControlService,
    @Inject(PlatformCoreApplicationService) private readonly platform: PlatformCoreApplicationService,
  ) {}

  @Get('overview')
  async overview(
    @Headers('authorization') authorization: string | undefined,
    @Headers('x-company-id') companyId: string | undefined,
    @Headers('x-branch-id') branchId: string | undefined,
    @Query('domain') domain: string | undefined,
    @Query('severity') severity: string | undefined,
    @Query('status') status: string | undefined,
    @Query('category') category: string | undefined,
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
  ): Promise<ManagementOverview> {
    const c = await this.context(authorization, companyId, branchId);
    await this.platform.requireBranchAccess(c.actorId, c.companyId, c.branchId);
    await this.platform.authorize(c.actorId, c.companyId, PLATFORM_CORE_PERMISSIONS.managementControlRead);
    // التحقق من الفلاتر بعد التفويض حتى لا يكشف 400 معلومات لمن لا يملك الصلاحية.
    return this.service.overview(c, parseWorkCenterFilter({ domain, severity, status, category, from, to }));
  }

  private async context(auth: string | undefined, company: string | undefined, branch: string | undefined): Promise<ExecutionContext> {
    if (!auth?.startsWith('Bearer ') || !company || !branch) throw new UnauthorizedException('authenticated company and branch context required');
    const user = await this.platform.currentUser(auth.slice(7));
    return executionContext(company, branch, user.id);
  }
}
