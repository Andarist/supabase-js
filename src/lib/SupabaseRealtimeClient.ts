import { RealtimeSubscription, RealtimeClient, Transformers } from '@supabase/realtime-js'
import { SupabaseRealtimePayload } from './types'

export class SupabaseRealtimeClient {
  subscription: RealtimeSubscription

  constructor(socket: RealtimeClient, schema: string, tableName: string) {
    const topic = tableName === '*' ? `realtime:${schema}` : `realtime:${schema}:${tableName}`
    this.subscription = socket.channel(topic)
  }

  private getPayloadRecords(payload: any) {
    const records = {
      new: {},
      old: {},
    }

    switch (payload.type) {
      case 'INSERT':
        records.new = Transformers.convertChangeData(payload.columns, payload.record)
        break

      case 'UPDATE':
        records.new = Transformers.convertChangeData(payload.columns, payload.record)
        records.old = Transformers.convertChangeData(payload.columns, payload.old_record)
        break

      case 'DELETE':
        records.old = Transformers.convertChangeData(payload.columns, payload.old_record)
        break
    }

    return records
  }

  /**
   * The event you want to listen to.
   *
   * @param event The event
   * @param callback A callback function that is called whenever the event occurs.
   */
  on(event: 'INSERT' | 'UPDATE' | 'DELETE' | '*', callback: Function) {
    this.subscription.on(event, (payload: any) => {
      let enrichedPayload: SupabaseRealtimePayload<any> = {
        schema: payload.schema,
        table: payload.table,
        commit_timestamp: payload.commit_timestamp,
        eventType: payload.type,
        new: {},
        old: {},
      }

      enrichedPayload = { ...enrichedPayload, ...this.getPayloadRecords(payload) }

      callback(enrichedPayload)
    })
    return this
  }

  /**
   * Enables the subscription.
   */
  subscribe(callback: Function = () => {}) {
    this.subscription.onError((e: Error) => callback('SUBSCRIPTION_ERROR', e))
    this.subscription.onClose(() => callback('CLOSED'))
    this.subscription
      .subscribe()
      .receive('ok', () => callback('SUBSCRIBED'))
      .receive('error', (e: Error) => callback('SUBSCRIPTION_ERROR', e))
      .receive('timeout', () => callback('RETRYING_AFTER_TIMEOUT'))
    return this.subscription
  }
}
