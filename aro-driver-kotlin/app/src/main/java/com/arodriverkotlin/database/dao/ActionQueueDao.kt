package com.arodriverkotlin.database.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import com.arodriverkotlin.database.entity.PendingAction

@Dao
interface ActionQueueDao {
    @Insert(onConflict = OnConflictStrategy.IGNORE)
    suspend fun insert(action: PendingAction)

    @Insert(onConflict = OnConflictStrategy.IGNORE)
    suspend fun insertAll(actions: List<PendingAction>)

    @Query("SELECT * FROM pending_actions WHERE uid = :uid AND isSynced = 0 ORDER BY timestamp ASC")
    suspend fun getUnsyncedActions(uid: String): List<PendingAction>

    @Query("SELECT * FROM pending_actions WHERE uid = :uid AND priority = :priority AND isSynced = 0 ORDER BY timestamp ASC")
    suspend fun getUnsyncedActionsByPriority(uid: String, priority: Int): List<PendingAction>

    @Query("SELECT * FROM pending_actions WHERE uid = :uid AND actionType = :type AND isSynced = 0 ORDER BY timestamp ASC LIMIT 1")
    suspend fun getNextAction(uid: String, type: String): PendingAction?

    @Query("UPDATE pending_actions SET retryCount = retryCount + 1, lastAttempt = :now WHERE id = :id")
    suspend fun incrementRetry(id: Long, now: Long)

    @Query("UPDATE pending_actions SET isSynced = 1 WHERE id = :id")
    suspend fun markSynced(id: Long)

    @Query("DELETE FROM pending_actions WHERE uid = :uid AND isSynced = 1 AND timestamp < :cutoff")
    suspend fun deleteOldSynced(uid: String, cutoff: Long)

    @Query("SELECT COUNT(*) FROM pending_actions WHERE uid = :uid AND isSynced = 0")
    suspend fun getPendingCount(uid: String): Int
}