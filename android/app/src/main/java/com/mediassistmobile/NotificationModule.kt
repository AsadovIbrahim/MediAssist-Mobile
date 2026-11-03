package com.mediassistmobile

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class NotificationModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "LocalNotificationModule"

    @ReactMethod
    fun scheduleNotification(
        id: Double,
        title: String,
        message: String,
        triggerTimeMillis: Double,
        deepLinkUrl: String?,
        promise: Promise
    ) {
        try {
            val alarmManager = reactContext.getSystemService(Context.ALARM_SERVICE) as AlarmManager
            val intent = Intent(reactContext, NotificationReceiver::class.java).apply {
                action = "com.mediassistmobile.APPOINTMENT_REMINDER"
                putExtra("id", id.toInt())
                putExtra("title", title)
                putExtra("message", message)
                putExtra("deepLinkUrl", deepLinkUrl)
            }

            val pendingIntent = PendingIntent.getBroadcast(
                reactContext,
                id.toInt(),
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )

            val trigger = triggerTimeMillis.toLong()

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    if (alarmManager.canScheduleExactAlarms()) {
                        alarmManager.setExactAndAllowWhileIdle(
                            AlarmManager.RTC_WAKEUP,
                            trigger,
                            pendingIntent
                        )
                    } else {
                        alarmManager.setAndAllowWhileIdle(
                            AlarmManager.RTC_WAKEUP,
                            trigger,
                            pendingIntent
                        )
                    }
                } else {
                    alarmManager.setExactAndAllowWhileIdle(
                        AlarmManager.RTC_WAKEUP,
                        trigger,
                        pendingIntent
                    )
                }
            } else {
                alarmManager.setExact(
                    AlarmManager.RTC_WAKEUP,
                    trigger,
                    pendingIntent
                )
            }

            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("SCHEDULE_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun cancelNotification(id: Double, promise: Promise) {
        try {
            val alarmManager = reactContext.getSystemService(Context.ALARM_SERVICE) as AlarmManager
            val intent = Intent(reactContext, NotificationReceiver::class.java).apply {
                action = "com.mediassistmobile.APPOINTMENT_REMINDER"
            }
            val pendingIntent = PendingIntent.getBroadcast(
                reactContext,
                id.toInt(),
                intent,
                PendingIntent.FLAG_NO_CREATE or PendingIntent.FLAG_IMMUTABLE
            )
            if (pendingIntent != null) {
                alarmManager.cancel(pendingIntent)
                pendingIntent.cancel()
            }
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("CANCEL_ERROR", e.message, e)
        }
    }
}

