package com.arodriverkotlin.database.converter

import androidx.room.TypeConverter

class Converters {
    @TypeConverter
    fun fromLong(value: Long?): java.util.Date? {
        return value?.let { java.util.Date(it) }
    }

    @TypeConverter
    fun fromDate(date: java.util.Date?): Long? {
        return date?.time
    }
}