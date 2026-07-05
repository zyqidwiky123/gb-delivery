package com.arodriverkotlin.database

import kotlinx.coroutines.sync.Mutex

object SyncCoordinator {
    val syncMutex = Mutex()
}
