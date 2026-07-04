package com.arodriverkotlin.database.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Update
import com.arodriverkotlin.database.entity.NavigationManeuver
import kotlinx.coroutines.flow.Flow

@Dao
interface NavigationManeuverDao {
    @Insert(onConflict = OnConflictStrategy.IGNORE)
    suspend fun insert(maneuver: NavigationManeuver)

    @Insert(onConflict = OnConflictStrategy.IGNORE)
    suspend fun insertAll(maneuvers: List<NavigationManeuver>)

    @Query("SELECT * FROM navigation_maneuvers WHERE orderId = :orderId AND isCompleted = 0 ORDER BY sequence ASC LIMIT 1")
    suspend fun getNextManeuver(orderId: String): NavigationManeuver?

    @Query("SELECT * FROM navigation_maneuvers WHERE orderId = :orderId ORDER BY sequence ASC")
    suspend fun getAllManeuvers(orderId: String): List<NavigationManeuver>

    @Query("UPDATE navigation_maneuvers SET isCompleted = 1 WHERE orderId = :orderId AND sequence = :sequence")
    suspend fun markCompleted(orderId: String, sequence: Int)

    @Query("DELETE FROM navigation_maneuvers WHERE orderId = :orderId")
    suspend fun deleteByOrderId(orderId: String)
}