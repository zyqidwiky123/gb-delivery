package com.arodriverkotlin.database.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Update
import com.arodriverkotlin.database.entity.TripState
import kotlinx.coroutines.flow.Flow

@Dao
interface TripStateDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(state: TripState)

    @Query("SELECT * FROM trip_state WHERE uid = :uid")
    suspend fun getState(uid: String): TripState?

    @Query("SELECT * FROM trip_state WHERE uid = :uid")
    fun observeState(uid: String): Flow<TripState?>

    @Query("DELETE FROM trip_state WHERE uid = :uid")
    suspend fun clearState(uid: String)

    @Query("UPDATE trip_state SET state = :state, orderId = :orderId, pickupLat = :pickupLat, pickupLng = :pickupLng, dropoffLat = :dropoffLat, dropoffLng = :dropoffLng, updatedAt = :updatedAt, version = version + 1 WHERE uid = :uid")
    suspend fun updateState(
        uid: String,
        state: String,
        orderId: String?,
        pickupLat: Double?,
        pickupLng: Double?,
        dropoffLat: Double?,
        dropoffLng: Double?,
        updatedAt: Long
    )
}