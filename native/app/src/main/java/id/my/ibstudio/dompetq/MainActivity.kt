package id.my.ibstudio.dompetq

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.viewModels
import androidx.compose.runtime.getValue
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import id.my.ibstudio.dompetq.ui.Rangka
import id.my.ibstudio.dompetq.ui.TemaDompetQ
import id.my.ibstudio.dompetq.ui.VM

class MainActivity : ComponentActivity() {

    private val vm: VM by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        /* Alarm bisa hilang di luar kendali aplikasi — force stop,
           penghemat baterai agresif, pemulihan cadangan. Dipasang
           ulang tiap kali aplikasi dibuka; memasang alarm yang sudah
           ada tidak menggandakannya. */
        vm.pasangUlangSemuaAlarm()

        setContent {
            TemaDompetQ {
                val keadaan by vm.keadaan.collectAsStateWithLifecycle()
                Rangka(vm, keadaan)
            }
        }
    }
}
