package com.arodriverkotlin.database

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.room.TypeConverters
import com.arodriverkotlin.database.dao.LocationDao
import com.arodriverkotlin.database.dao.ActionQueueDao
import com.arodriverkotlin.database.dao.TripStateDao
import com.arodriverkotlin.database.entity.PendingLocation
import com.arodriverkotlin.database.entity.PendingAction
import com.arodriverkotlin.database.entity.TripState
import com.arodriverkotlin.database.converter.Converters

@Database(
    entities = [PendingLocation::class, PendingAction::class, TripState::class],
    version = 1,
    exportSchema = true
)
@TypeConverters(Converters::class)
abstract class AppDatabase : RoomDatabase() {
    abstract fun locationDao(): LocationDao
    abstract fun actionQueueDao(): ActionQueueDao
    abstract fun tripStateDao(): TripStateDao

    companion object {
        @Volatile private var INSTANCE: AppDatabase? = null

        fun getInstance(context: Context): AppDatabase {
            return INSTANCE ?: synchronized(this) {
                val instance = Room.databaseBuilder(
                    context.applicationContext,
                    AppDatabase::class.java,
                    "aro_driver_db"
                ).fallbackToDestructiveMigration()
                    .build()
                INSTANCE = instance
                instance
            }
        }
    }
}