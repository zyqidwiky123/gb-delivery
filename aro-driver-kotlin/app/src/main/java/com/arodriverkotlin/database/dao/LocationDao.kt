package com.arodriverkotlin.database.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import com.arodriverkotlin.database.entity.PendingLocation
import kotlinx.coroutines.flow.Flow

@Dao
interface LocationDao {
    @Insert(onConflict = OnConflictStrategy.IGNORE)
    suspend fun insert(location: PendingLocation)

    @Insert(onConflict = OnConflictStrategy.IGNORE)
    suspend fun insertAll(locations: List<PendingLocation>)

    @Query("SELECT * FROM pending_locations WHERE uid = :uid ORDER BY timestamp ASC LIMIT :limit")
    suspend fun getPendingLocations(uid: String, limit: Int): List<PendingLocation>

    @Query("SELECT COUNT(*) FROM pending_locations WHERE uid = :uid")
    suspend fun getPendingCount(uid: String): Int

    @Query("DELETE FROM pending_locations WHERE id IN (:ids)")
    suspend fun deleteByIds(ids: List<Long>)

    @Query("DELETE FROM pending_locations WHERE uid = :uid AND timestamp < :cutoff")
    suspend fun deleteOldLocations(uid: String, cutoff: Long)

    @Query("UPDATE pending_locations SET retryCount = retryCount + 1, lastAttempt = :now WHERE id = :id")
    suspend fun incrementRetry(id: Long, now: Long)
}