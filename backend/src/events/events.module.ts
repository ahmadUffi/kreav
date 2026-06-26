import { Module } from '@nestjs/common';
import { EventLogListener } from './event-log.listener';

/**
 * Events Module — BE-006.
 *
 * Wires the domain-event listeners. The `EventEmitterModule.forRoot()` itself
 * is registered in AppModule (it must be a top-level import to hook the
 * @OnEvent decorator before any module emits). This module only provides the
 * listeners so the logging hook is active app-wide.
 */
@Module({
  providers: [EventLogListener],
  exports: [EventLogListener],
})
export class EventsModule {}
