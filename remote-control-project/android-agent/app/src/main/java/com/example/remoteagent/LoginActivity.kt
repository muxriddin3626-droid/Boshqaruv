package com.example.remoteagent

import android.content.Intent
import android.os.Bundle
import android.widget.Button
import android.widget.EditText
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity

/**
 * Ro'yxatdan o'tish / kirish ekrani. Muvaffaqiyatli kirishdan so'ng
 * bu qurilma backend'da "agent" turi sifatida ro'yxatga olinadi va
 * MainActivity'ga o'tiladi.
 */
class LoginActivity : AppCompatActivity() {

    private lateinit var emailInput: EditText
    private lateinit var passwordInput: EditText
    private lateinit var statusText: TextView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_login)

        emailInput = findViewById(R.id.emailInput)
        passwordInput = findViewById(R.id.passwordInput)
        statusText = findViewById(R.id.statusText)
        val loginBtn = findViewById<Button>(R.id.loginBtn)
        val registerBtn = findViewById<Button>(R.id.registerBtn)

        // Avval saqlangan sessiya bo'lsa, to'g'ridan-to'g'ri o'tib ketamiz
        if (SessionStore.load(this)) {
            goToMain()
            return
        }

        loginBtn.setOnClickListener { submit(isRegister = false) }
        registerBtn.setOnClickListener { submit(isRegister = true) }
    }

    private fun submit(isRegister: Boolean) {
        val email = emailInput.text.toString().trim()
        val password = passwordInput.text.toString()
        if (email.isEmpty() || password.length < 6) {
            Toast.makeText(this, "Email va kamida 6 belgili parol kiriting", Toast.LENGTH_SHORT).show()
            return
        }
        statusText.text = "Yuborilmoqda..."

        val onAuthDone: (String?, String?) -> Unit = { token, error ->
            runOnUiThread {
                if (error != null || token == null) {
                    statusText.text = "Xatolik: ${error ?: "noma'lum"}"
                    return@runOnUiThread
                }
                AuthStore.token = token
                registerDevice()
            }
        }

        if (isRegister) AuthApi.register(email, password, onAuthDone)
        else AuthApi.login(email, password, onAuthDone)
    }

    private fun registerDevice() {
        AuthApi.registerDevice(
            name = android.os.Build.MODEL,
            role = "agent",
            platform = "android"
        ) { deviceId, error ->
            runOnUiThread {
                if (error != null || deviceId == null) {
                    statusText.text = "Qurilmani ro'yxatga olishda xatolik: $error"
                    return@runOnUiThread
                }
                AuthStore.deviceId = deviceId
                SessionStore.save(this, AuthStore.token!!, deviceId)
                goToMain()
            }
        }
    }

    private fun goToMain() {
        startActivity(Intent(this, MainActivity::class.java))
        finish()
    }
}
