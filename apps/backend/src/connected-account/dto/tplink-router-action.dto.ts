import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export const TPLINK_ROUTER_ACTIONS = [
  'wifi',
  'block',
  'unblock',
  'accessControl',
  'reservationAdd',
  'reservationDelete',
  'portForwardAdd',
  'portForwardDelete',
  'wanRenew',
  'reboot',
] as const;

export type TplinkRouterAction = (typeof TPLINK_ROUTER_ACTIONS)[number];

/** Uma ação na página do router; os campos usados dependem da ação. */
export class TplinkRouterActionDto {
  @IsIn(TPLINK_ROUTER_ACTIONS)
  action: TplinkRouterAction;

  /** wifi: a rede (host = a principal, guest = convidados, iot). */
  @IsOptional()
  @IsIn(['host', 'guest', 'iot'])
  network?: 'host' | 'guest' | 'iot';

  /** wifi: a banda. */
  @IsOptional()
  @IsIn(['2g', '5g', '6g'])
  band?: '2g' | '5g' | '6g';

  /** wifi e accessControl: ligar (true) ou desligar (false). */
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  /** accessControl: lista negra ou lista branca. */
  @IsOptional()
  @IsIn(['blacklist', 'whitelist'])
  mode?: 'blacklist' | 'whitelist';

  /** block, unblock, reservationAdd, reservationDelete: o MAC do dispositivo. */
  @IsOptional()
  @IsString()
  @MaxLength(32)
  mac?: string;

  /** block, reservationAdd, portForwardAdd, portForwardDelete: o nome. */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  name?: string;

  /** reservationAdd, portForwardAdd: o IP. */
  @IsOptional()
  @IsString()
  @MaxLength(15)
  ip?: string;

  /** portForwardAdd: a porta de fora (uma ou um intervalo "8000-8100") e a de dentro. */
  @IsOptional()
  @IsString()
  @MaxLength(11)
  externalPort?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5)
  internalPort?: string;

  @IsOptional()
  @IsIn(['TCP', 'UDP', 'ALL'])
  protocol?: 'TCP' | 'UDP' | 'ALL';
}
